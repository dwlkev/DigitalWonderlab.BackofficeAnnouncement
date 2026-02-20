(function () {
    "use strict";
    angular.module("umbraco").controller("BackofficeAnnouncementV13Controller", function ($element, $timeout) {
        $timeout(function () {
            if (window.BackofficeAnnouncementV13 && typeof window.BackofficeAnnouncementV13.init === "function") {
                window.BackofficeAnnouncementV13.init($element[0]);
            }
        }, 0);
    });
})();
