(function () {
    "use strict";

    var BAR_CONTAINER_ID = "backoffice-announcement-bars";
    var POLL_INTERVAL = 60000;
    var dismissedIds = {};
    var currentUserGroupAliases = null;

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function renderBars(announcements) {
        var container = document.getElementById(BAR_CONTAINER_ID);
        if (!container) {
            container = document.createElement("div");
            container.id = BAR_CONTAINER_ID;
            document.body.insertBefore(container, document.body.firstChild);
        }

        container.innerHTML = "";

        var visible = announcements.filter(function (a) { return !dismissedIds[a.id]; });

        visible.forEach(function (a) {
            var bar = document.createElement("div");
            bar.className = "ba-bar";
            bar.dataset.id = a.id;
            bar.style.backgroundColor = a.backgroundColor || "#1b264f";
            bar.style.color = a.textColor || "#ffffff";
            bar.innerHTML =
                '<div class="ba-bar-inner">' +
                    '<span class="ba-bar-message">' + escapeHtml(a.message) + '</span>' +
                    '<button class="ba-bar-dismiss" title="Dismiss" style="color:' +
                        (a.textColor || "#ffffff") + ';display:' +
                        (a.allowDismiss !== false ? '' : 'none') + '">&times;</button>' +
                '</div>';

            bar.querySelector(".ba-bar-dismiss").addEventListener("click", function () {
                dismissedIds[a.id] = true;
                bar.remove();
                adjustBodyPadding();
            });

            container.appendChild(bar);
        });

        adjustBodyPadding();
    }

    function adjustBodyPadding() {
        var container = document.getElementById(BAR_CONTAINER_ID);
        var height = container ? container.offsetHeight : 0;

        // Umbraco 13 shell is rooted in #mainwrapper. Offset only that wrapper
        // so header/nav/content move together without shifting nested layers.
        var mainWrapper = document.getElementById("mainwrapper");
        if (mainWrapper) {
            mainWrapper.style.top = height ? height + "px" : "";
            mainWrapper.style.height = height ? "calc(100% - " + height + "px)" : "";
        }

        // Fallback for regular flow nodes.
        document.body.style.paddingTop = height ? height + "px" : "";
    }

    function injectStyles() {
        if (document.getElementById("ba-bar-styles")) return;

        var style = document.createElement("style");
        style.id = "ba-bar-styles";
        style.textContent =
            "#" + BAR_CONTAINER_ID + " {" +
                "position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;" +
            "}" +
            ".ba-bar {" +
                "font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);" +
            "}" +
            ".ba-bar-inner {" +
                "display: flex; align-items: center; justify-content: center;" +
                "padding: 10px 40px 10px 16px; min-height: 20px; position: relative;" +
            "}" +
            ".ba-bar-message {" +
                "flex: 1; text-align: center; line-height: 1.4;" +
            "}" +
            ".ba-bar-dismiss {" +
                "position: absolute; right: 10px; top: 50%; transform: translateY(-50%);" +
                "background: none; border: none; font-size: 20px;" +
                "cursor: pointer; padding: 4px 8px; opacity: 0.8; line-height: 1;" +
            "}" +
            ".ba-bar-dismiss:hover { opacity: 1; }";

        document.head.appendChild(style);
    }

    function filterByUserGroup(announcements) {
        if (!currentUserGroupAliases) return announcements;
        return announcements.filter(function (a) {
            return !a.targetUserGroup || currentUserGroupAliases.indexOf(a.targetUserGroup) !== -1;
        });
    }

    function fetchCurrentUserGroupsViaAngular() {
        return new Promise(function (resolve) {
            // Use Angular's injector to get the current user via Umbraco's userService
            try {
                var injector = angular.element(document.body).injector();
                if (!injector) {
                    console.warn("[BackofficeAnnouncement] Angular injector not available");
                    resolve();
                    return;
                }
                var userService = injector.get("userService");
                userService.getCurrentUser().then(function (user) {
                    console.log("[BackofficeAnnouncement] Current user:", user.name, "Groups:", user.groups);
                    if (user.groups && Array.isArray(user.groups)) {
                        currentUserGroupAliases = user.groups.map(function (g) {
                            return g.alias;
                        });
                    } else if (user.userGroups && Array.isArray(user.userGroups)) {
                        currentUserGroupAliases = user.userGroups.map(function (g) {
                            return typeof g === "string" ? g : g.alias;
                        });
                    }
                    console.log("[BackofficeAnnouncement] User group aliases:", currentUserGroupAliases);
                    resolve();
                }, function (err) {
                    console.error("[BackofficeAnnouncement] userService.getCurrentUser failed:", err);
                    resolve();
                });
            } catch (e) {
                console.error("[BackofficeAnnouncement] Failed to get user via Angular:", e);
                resolve();
            }
        });
    }

    async function poll() {
        try {
            var res = await fetch("/umbraco/api/backofficeannouncement/status", {
                headers: { "x-requested-with": "XMLHttpRequest" }
            });
            var announcements = await res.json();

            if (Array.isArray(announcements) && announcements.length > 0) {
                renderBars(filterByUserGroup(announcements));
            } else {
                renderBars([]);
            }
        } catch (e) {
            console.error("[BackofficeAnnouncement] poll failed:", e);
        }
    }

    function start() {
        injectStyles();

        // Wait a moment for Angular to be fully bootstrapped, then get user groups
        setTimeout(function () {
            fetchCurrentUserGroupsViaAngular().then(function () {
                poll();
            });
        }, 1000);

        setInterval(function () { poll(); }, POLL_INTERVAL);

        window.addEventListener("backoffice-announcement-updated", function () {
            dismissedIds = {};
            poll();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
