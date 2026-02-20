import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";

export default class BackofficeAnnouncementDashboard extends UmbElementMixin(HTMLElement) {
    /** @type {import('@umbraco-cms/backoffice/notification').UmbNotificationContext} */
    #notificationContext;

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

        this.shadowRoot.getElementById("saveBtn").addEventListener("click", () => this.saveSettings());

        this.loadSettings();
    }

    async loadSettings() {
        try {
            const response = await fetch("/umbraco/api/backofficeannouncement/settings");
            const data = await response.json();

            const toggle = this.shadowRoot.getElementById("enabledToggle");
            const messageInput = this.shadowRoot.getElementById("messageInput");
            const statusIndicator = this.shadowRoot.getElementById("statusIndicator");

            if (toggle) toggle.checked = data.enabled;
            if (messageInput) messageInput.value = data.message || "";
            this.updateStatusIndicator(data.enabled);
        } catch (error) {
            console.error("Failed to load announcement settings", error);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Error", message: "Failed to load announcement settings." },
            });
        }
    }

    async saveSettings() {
        const toggle = this.shadowRoot.getElementById("enabledToggle");
        const messageInput = this.shadowRoot.getElementById("messageInput");

        const settings = {
            enabled: toggle?.checked ?? false,
            message: messageInput?.value ?? ""
        };

        try {
            const response = await fetch("/umbraco/api/backofficeannouncement/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.updateStatusIndicator(settings.enabled);
                this.#notificationContext?.peek("positive", {
                    data: { headline: "Settings saved!", message: "Announcement settings have been updated." },
                });
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

    updateStatusIndicator(enabled) {
        const statusIndicator = this.shadowRoot.getElementById("statusIndicator");
        if (!statusIndicator) return;

        if (enabled) {
            statusIndicator.textContent = "Active";
            statusIndicator.className = "status-badge status-active";
        } else {
            statusIndicator.textContent = "Inactive";
            statusIndicator.className = "status-badge status-inactive";
        }
    }
}

customElements.define("backoffice-announcement-dashboard", BackofficeAnnouncementDashboard);
