(function (w) {

    function init(root, notificationsService) {
        var userGroups = [];
        var listEl = root.querySelector("#announcementList");
        var templateEl = root.querySelector("#announcementCardTemplate");
        var addBtn = root.querySelector("#addAnnouncementBtn");

        function generateId() {
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }

        function populateUserGroupSelect(select, selectedAlias) {
            select.innerHTML = '<option value="">All users</option>';
            for (var i = 0; i < userGroups.length; i++) {
                var g = userGroups[i];
                var opt = document.createElement("option");
                opt.value = g.alias;
                opt.textContent = g.name;
                if (g.alias === selectedAlias) opt.selected = true;
                select.appendChild(opt);
            }
        }

        function updateCardPreview(card) {
            var preview = card.querySelector(".bar-preview");
            var previewMsg = card.querySelector(".card-preview-message");
            var bgInput = card.querySelector(".card-bg-input");
            var txtInput = card.querySelector(".card-txt-input");
            var messageInput = card.querySelector(".card-message");

            if (preview && bgInput) preview.style.backgroundColor = bgInput.value;
            if (preview && txtInput) preview.style.color = txtInput.value;
            if (previewMsg && messageInput) {
                previewMsg.textContent = messageInput.value || "Your announcement message here";
            }
        }

        function setupColorSync(picker, input, card) {
            picker.addEventListener("input", function () {
                input.value = picker.value;
                updateCardPreview(card);
            });
            input.addEventListener("input", function () {
                if (/^#[0-9a-fA-F]{6}$/.test(input.value)) {
                    picker.value = input.value;
                }
                updateCardPreview(card);
            });
        }

        function addCard(data) {
            var card = templateEl.content.cloneNode(true).querySelector(".announcement-card");

            card.dataset.id = data.id;

            var q = function (sel) { return card.querySelector(sel); };

            var enabledToggle = q(".card-enabled-toggle");
            enabledToggle.checked = data.enabled;

            var summary = q(".card-summary");
            summary.textContent = data.message || "New announcement";

            var badge = q(".card-user-group-badge");
            var group = userGroups.find(function (g) { return g.alias === data.targetUserGroup; });
            badge.textContent = group ? group.name : data.targetUserGroup ? data.targetUserGroup : "";

            var toggleBtn = q(".card-toggle-btn");
            var body = q(".card-body");
            toggleBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                body.classList.toggle("collapsed");
                toggleBtn.classList.toggle("collapsed");
            });

            q(".card-delete-btn").addEventListener("click", function (e) {
                e.stopPropagation();
                card.remove();
                save();
            });

            var messageInput = q(".card-message");
            messageInput.value = data.message || "";
            messageInput.addEventListener("input", function () {
                summary.textContent = messageInput.value || "New announcement";
                updateCardPreview(card);
            });

            var userGroupSelect = q(".card-user-group");
            populateUserGroupSelect(userGroupSelect, data.targetUserGroup);
            userGroupSelect.addEventListener("change", function () {
                var selected = userGroups.find(function (g) { return g.alias === userGroupSelect.value; });
                badge.textContent = selected ? selected.name : "";
            });

            var allowDismiss = q(".card-allow-dismiss");
            allowDismiss.checked = data.allowDismiss !== false;

            var bgPicker = q(".card-bg-picker");
            var bgInput = q(".card-bg-input");
            bgPicker.value = data.backgroundColor || "#1b264f";
            bgInput.value = data.backgroundColor || "#1b264f";
            setupColorSync(bgPicker, bgInput, card);

            var txtPicker = q(".card-txt-picker");
            var txtInput = q(".card-txt-input");
            txtPicker.value = data.textColor || "#ffffff";
            txtInput.value = data.textColor || "#ffffff";
            setupColorSync(txtPicker, txtInput, card);

            updateCardPreview(card);

            listEl.appendChild(card);
        }

        function gatherData() {
            var cards = listEl.querySelectorAll(".announcement-card");
            var announcements = [];
            cards.forEach(function (card) {
                var q = function (sel) { return card.querySelector(sel); };
                announcements.push({
                    id: card.dataset.id,
                    enabled: q(".card-enabled-toggle").checked,
                    message: q(".card-message").value,
                    allowDismiss: q(".card-allow-dismiss").checked,
                    backgroundColor: q(".card-bg-input").value || "#1b264f",
                    textColor: q(".card-txt-input").value || "#ffffff",
                    targetUserGroup: q(".card-user-group").value
                });
            });
            return { announcements: announcements };
        }

        async function save() {
            var settings = gatherData();
            try {
                var res = await fetch("/umbraco/api/backofficeannouncement/settings", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-requested-with": "XMLHttpRequest"
                    },
                    body: JSON.stringify(settings)
                });
                if (res.ok) {
                    if (notificationsService) {
                        notificationsService.success("Settings saved", "Announcement settings have been updated.");
                    }
                    window.dispatchEvent(new CustomEvent("backoffice-announcement-updated"));
                } else {
                    if (notificationsService) {
                        notificationsService.error("Error", "Failed to save announcement settings.");
                    }
                }
            } catch (e) {
                console.error("Failed to save announcement settings", e);
                if (notificationsService) {
                    notificationsService.error("Error", "Failed to save announcement settings.");
                }
            }
        }

        async function loadUserGroups() {
            try {
                var res = await fetch("/umbraco/api/backofficeannouncement/usergroups", {
                    headers: { "x-requested-with": "XMLHttpRequest" }
                });
                userGroups = await res.json();
            } catch (e) {
                console.error("Failed to load user groups", e);
            }
        }

        async function loadSettings() {
            try {
                var res = await fetch("/umbraco/api/backofficeannouncement/settings", {
                    headers: { "x-requested-with": "XMLHttpRequest" }
                });
                var data = await res.json();

                listEl.innerHTML = "";
                if (data.announcements && data.announcements.length > 0) {
                    data.announcements.forEach(function (a) { addCard(a); });
                }
            } catch (e) {
                console.error("Failed to load announcement settings", e);
            }
        }

        addBtn.addEventListener("click", function () {
            addCard({
                id: generateId(),
                enabled: false,
                message: "",
                allowDismiss: true,
                backgroundColor: "#1b264f",
                textColor: "#ffffff",
                targetUserGroup: ""
            });
        });

        root.querySelector("#saveAnnouncementsBtn").addEventListener("click", function () {
            save();
        });

        loadUserGroups().then(function () { loadSettings(); });
    }

    w.BackofficeAnnouncementV13 = { init: init };
})(window);
