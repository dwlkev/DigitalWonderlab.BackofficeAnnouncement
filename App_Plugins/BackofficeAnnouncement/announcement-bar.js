import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";

const BAR_CONTAINER_ID = "backoffice-announcement-bars";
const POLL_INTERVAL = 60000;
let dismissedIds = {};
let currentUserGroupAliases = null;

function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function renderBars(announcements) {
    let container = document.getElementById(BAR_CONTAINER_ID);
    if (!container) {
        container = document.createElement("div");
        container.id = BAR_CONTAINER_ID;
        document.body.insertBefore(container, document.body.firstChild);
    }

    container.innerHTML = "";

    const visible = announcements.filter(a => !dismissedIds[a.id]);

    for (const a of visible) {
        const bar = document.createElement("div");
        bar.className = "ba-bar";
        bar.dataset.id = a.id;
        bar.style.backgroundColor = a.backgroundColor || "#1b264f";
        bar.style.color = a.textColor || "#ffffff";
        bar.innerHTML =
            `<div class="ba-bar-inner">` +
                `<span class="ba-bar-message">${escapeHtml(a.message)}</span>` +
                `<button class="ba-bar-dismiss" title="Dismiss" style="color:${a.textColor || "#ffffff"};display:${a.allowDismiss !== false ? '' : 'none'}">&times;</button>` +
            `</div>`;

        bar.querySelector(".ba-bar-dismiss").addEventListener("click", () => {
            dismissedIds[a.id] = true;
            bar.remove();
            adjustBodyPadding();
        });

        container.appendChild(bar);
    }

    adjustBodyPadding();
}

function findInShadowDOM(selector, root = document) {
    // Try direct query first
    let element = root.querySelector(selector);
    if (element) return element;

    // Recursively search through shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
        if (el.shadowRoot) {
            element = findInShadowDOM(selector, el.shadowRoot);
            if (element) return element;
        }
    }
    return null;
}

function adjustBodyPadding() {
    const container = document.getElementById(BAR_CONTAINER_ID);
    const height = container ? container.offsetHeight : 0;

    // Set body padding
    document.body.style.paddingTop = height ? height + "px" : "";

    // Find umb-backoffice-main through shadow DOM with retry
    function tryAdjust(retries = 0) {
        const backofficeMain = findInShadowDOM("umb-backoffice-main");

        if (backofficeMain) {
            const newHeight = height ? `calc(100% - ${60 + height}px)` : "";
            backofficeMain.style.height = newHeight;
        } else if (retries < 10) {
            setTimeout(() => tryAdjust(retries + 1), 100);
        }
    }

    tryAdjust();
}

function injectStyles() {
    if (document.getElementById("ba-bar-styles")) return;

    const style = document.createElement("style");
    style.id = "ba-bar-styles";
    style.textContent = `
        #${BAR_CONTAINER_ID} {
            position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
            max-height: 120px; overflow-y: auto; overflow-x: hidden;
        }
        .ba-bar {
            font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .ba-bar-inner {
            display: flex; align-items: center; justify-content: center;
            padding: 10px 40px 10px 16px; min-height: 20px; position: relative;
        }
        .ba-bar-message {
            flex: 1; text-align: center; line-height: 1.4;
        }
        .ba-bar-dismiss {
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; font-size: 20px;
            cursor: pointer; padding: 4px 8px; opacity: 0.8; line-height: 1;
        }
        .ba-bar-dismiss:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
}

function filterByUserGroup(announcements) {
    if (!currentUserGroupAliases) return announcements;
    return announcements.filter(a => {
        // If no target groups specified, show to everyone
        if (!a.targetUserGroups || a.targetUserGroups.length === 0) return true;
        // Check if user is in ANY of the target groups
        return a.targetUserGroups.some(group => currentUserGroupAliases.includes(group));
    });
}

async function fetchCurrentUserGroups(authToken) {
    try {
        const headers = {};
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
        }

        const userRes = await fetch("/umbraco/management/api/v1/user/current", { headers });
        if (!userRes.ok) return;
        const user = await userRes.json();

        // Map userGroupIds (array of {id: "guid"} objects) to aliases
        var groupIds = (user.userGroupIds || []).map(g => g.id);
        if (groupIds.length > 0) {
            const groupsRes = await fetch("/umbraco/api/backofficeannouncement/usergroups");
            if (!groupsRes.ok) return;
            const allGroups = await groupsRes.json();

            currentUserGroupAliases = allGroups
                .filter(g => groupIds.includes(g.key))
                .map(g => g.alias);
        }
    } catch (e) {
        console.error("[BackofficeAnnouncement] fetchCurrentUserGroups failed:", e);
    }
}

async function poll() {
    try {
        const res = await fetch("/umbraco/api/backofficeannouncement/status");
        const announcements = await res.json();

        if (Array.isArray(announcements) && announcements.length > 0) {
            renderBars(filterByUserGroup(announcements));
        } else {
            renderBars([]);
        }
    } catch (e) {
        console.error("[BackofficeAnnouncement] poll failed:", e);
    }
}

// Entry point for Umbraco 14+ backoffice
export const onInit = (host) => {
    injectStyles();

    host.consumeContext(UMB_AUTH_CONTEXT, async (authContext) => {
        if (authContext) {
            try {
                const token = await authContext.getLatestToken();
                await fetchCurrentUserGroups(token);
            } catch (e) {
                console.error("[BackofficeAnnouncement] Token/user fetch failed:", e);
            }
        }
        poll();
        setInterval(poll, POLL_INTERVAL);

        window.addEventListener("backoffice-announcement-updated", () => {
            dismissedIds = {};
            poll();
        });
    });
};

export default {};
