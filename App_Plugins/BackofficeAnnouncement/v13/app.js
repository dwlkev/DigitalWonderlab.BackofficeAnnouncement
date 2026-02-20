(function (w) {

    function init(root) {
        var q = function (sel) { return root.querySelector(sel); };
        var byId = function (id) { return root.querySelector("#" + id); };

        var enabledToggle = byId("enabledToggle");
        var messageInput = byId("messageInput");
        var saveBtn = byId("saveBtn");
        var statusIndicator = byId("statusIndicator");

        function updateStatusIndicator(enabled) {
            if (!statusIndicator) return;
            if (enabled) {
                statusIndicator.textContent = "Active";
                statusIndicator.className = "status-badge status-active";
            } else {
                statusIndicator.textContent = "Inactive";
                statusIndicator.className = "status-badge status-inactive";
            }
        }

        async function loadSettings() {
            try {
                var res = await fetch("/umbraco/api/backofficeannouncement/settings", {
                    headers: { "x-requested-with": "XMLHttpRequest" }
                });
                var data = await res.json();

                if (enabledToggle) enabledToggle.checked = data.enabled;
                if (messageInput) messageInput.value = data.message || "";
                updateStatusIndicator(data.enabled);
            } catch (e) {
                console.error("Failed to load announcement settings", e);
            }
        }

        async function saveSettings() {
            var settings = {
                enabled: enabledToggle ? enabledToggle.checked : false,
                message: messageInput ? messageInput.value : ""
            };

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
                    updateStatusIndicator(settings.enabled);
                    alert("Settings saved successfully!");
                } else {
                    alert("Failed to save settings.");
                }
            } catch (e) {
                console.error("Failed to save announcement settings", e);
                alert("Failed to save settings.");
            }
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", function () { saveSettings(); });
        }

        loadSettings();
    }

    w.BackofficeAnnouncementV13 = { init: init };
})(window);
