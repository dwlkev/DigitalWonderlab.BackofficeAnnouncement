import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";

export default class BackofficeAnnouncementDashboard extends UmbElementMixin(HTMLElement) {
    #notificationContext;
    #userGroups = [];

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.loadTemplate();
        this.loadStyles();
    }

    async loadTemplate() {
        const response = await fetch("/App_Plugins/BackofficeAnnouncement/backoffice-announcement-template.html");
        const templateText = await response.text();
        const template = document.createElement("template");
        template.innerHTML = templateText;
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.afterTemplateLoaded();
    }

    loadStyles() {
        const style = document.createElement("link");
        style.setAttribute("rel", "stylesheet");
        style.setAttribute("href", "/App_Plugins/BackofficeAnnouncement/backoffice-announcement-style.css");
        this.shadowRoot.appendChild(style);
    }

    afterTemplateLoaded() {
        this.consumeContext(UMB_NOTIFICATION_CONTEXT, (instance) => {
            this.#notificationContext = instance;
        });

        this.shadowRoot.getElementById("addAnnouncementBtn").addEventListener("click", () => {
            this.addCard({
                id: crypto.randomUUID(),
                enabled: false,
                message: "",
                allowDismiss: true,
                backgroundColor: "#1b264f",
                textColor: "#ffffff",
                targetUserGroup: ""
            });
        });

        this.shadowRoot.getElementById("saveAnnouncementsBtn").addEventListener("click", () => {
            this.save();
        });

        this.loadUserGroups().then(() => this.loadSettings());
    }

    async loadUserGroups() {
        try {
            const res = await fetch("/umbraco/api/backofficeannouncement/usergroups");
            this.#userGroups = await res.json();
        } catch (e) {
            console.error("Failed to load user groups", e);
        }
    }

    populateUserGroupSelect(select, selectedAlias) {
        select.innerHTML = '<option value="">All users</option>';
        for (const g of this.#userGroups) {
            const opt = document.createElement("option");
            opt.value = g.alias;
            opt.textContent = g.name;
            if (g.alias === selectedAlias) opt.selected = true;
            select.appendChild(opt);
        }
    }

    addCard(data) {
        const list = this.shadowRoot.getElementById("announcementList");
        const template = this.shadowRoot.getElementById("announcementCardTemplate");
        const card = template.content.cloneNode(true).querySelector(".announcement-card");

        card.dataset.id = data.id;

        const q = (sel) => card.querySelector(sel);

        // Header
        const enabledToggle = q(".card-enabled-toggle");
        enabledToggle.checked = data.enabled;

        const summary = q(".card-summary");
        summary.textContent = data.message || "New announcement";

        const badge = q(".card-user-group-badge");
        const group = this.#userGroups.find(g => g.alias === data.targetUserGroup);
        badge.textContent = group ? group.name : data.targetUserGroup ? data.targetUserGroup : "";

        // Toggle expand/collapse
        const toggleBtn = q(".card-toggle-btn");
        const body = q(".card-body");
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            body.classList.toggle("collapsed");
            toggleBtn.classList.toggle("collapsed");
        });

        // Delete
        q(".card-delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            card.remove();
            this.save();
        });

        // Body fields
        const messageInput = q(".card-message");
        messageInput.value = data.message || "";
        messageInput.addEventListener("input", () => {
            summary.textContent = messageInput.value || "New announcement";
            this.updateCardPreview(card);
        });

        const userGroupSelect = q(".card-user-group");
        this.populateUserGroupSelect(userGroupSelect, data.targetUserGroup);
        userGroupSelect.addEventListener("change", () => {
            const selected = this.#userGroups.find(g => g.alias === userGroupSelect.value);
            badge.textContent = selected ? selected.name : "";
        });

        const allowDismiss = q(".card-allow-dismiss");
        allowDismiss.checked = data.allowDismiss !== false;

        const bgPicker = q(".card-bg-picker");
        const bgInput = q(".card-bg-input");
        bgPicker.value = data.backgroundColor || "#1b264f";
        bgInput.value = data.backgroundColor || "#1b264f";
        this.setupColorSync(bgPicker, bgInput, card);

        const txtPicker = q(".card-txt-picker");
        const txtInput = q(".card-txt-input");
        txtPicker.value = data.textColor || "#ffffff";
        txtInput.value = data.textColor || "#ffffff";
        this.setupColorSync(txtPicker, txtInput, card);

        this.updateCardPreview(card);

        list.appendChild(card);
    }

    setupColorSync(picker, input, card) {
        picker.addEventListener("input", () => {
            input.value = picker.value;
            this.updateCardPreview(card);
        });
        input.addEventListener("input", () => {
            if (/^#[0-9a-fA-F]{6}$/.test(input.value)) {
                picker.value = input.value;
            }
            this.updateCardPreview(card);
        });
    }

    updateCardPreview(card) {
        const preview = card.querySelector(".bar-preview");
        const previewMsg = card.querySelector(".card-preview-message");
        const bgInput = card.querySelector(".card-bg-input");
        const txtInput = card.querySelector(".card-txt-input");
        const messageInput = card.querySelector(".card-message");

        if (preview && bgInput) preview.style.backgroundColor = bgInput.value;
        if (preview && txtInput) preview.style.color = txtInput.value;
        if (previewMsg && messageInput) {
            previewMsg.textContent = messageInput.value || "Your announcement message here";
        }
    }

    gatherData() {
        const cards = this.shadowRoot.querySelectorAll(".announcement-card");
        const announcements = [];

        for (const card of cards) {
            const q = (sel) => card.querySelector(sel);
            announcements.push({
                id: card.dataset.id,
                enabled: q(".card-enabled-toggle").checked,
                message: q(".card-message").value,
                allowDismiss: q(".card-allow-dismiss").checked,
                backgroundColor: q(".card-bg-input").value || "#1b264f",
                textColor: q(".card-txt-input").value || "#ffffff",
                targetUserGroup: q(".card-user-group").value
            });
        }

        return { announcements };
    }

    async save() {
        const settings = this.gatherData();

        try {
            const response = await fetch("/umbraco/api/backofficeannouncement/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.#notificationContext?.peek("positive", {
                    data: { headline: "Settings saved!", message: "Announcement settings have been updated." },
                });
                window.dispatchEvent(new CustomEvent("backoffice-announcement-updated"));
            } else {
                throw new Error("Save failed");
            }
        } catch (error) {
            console.error("Failed to save announcement settings", error);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Error", message: "Failed to save announcement settings." },
            });
        }
    }

    async loadSettings() {
        try {
            const response = await fetch("/umbraco/api/backofficeannouncement/settings");
            const data = await response.json();

            const list = this.shadowRoot.getElementById("announcementList");
            list.innerHTML = "";

            if (data.announcements && data.announcements.length > 0) {
                for (const a of data.announcements) {
                    this.addCard(a);
                }
            }
        } catch (error) {
            console.error("Failed to load announcement settings", error);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Error", message: "Failed to load announcement settings." },
            });
        }
    }
}

customElements.define("backoffice-announcement-dashboard", BackofficeAnnouncementDashboard);
