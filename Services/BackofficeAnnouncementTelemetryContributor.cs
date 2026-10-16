using System.Linq;
using DigitalWonderlab.Telemetry;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace DigitalWonderlab.BackofficeAnnouncement;

/// <summary>
/// What Backoffice Announcement reports in its anonymous daily heartbeat: how many announcements exist and are
/// enabled (banded), and whether targeting/dismissal are used. Never the message text. See README "Telemetry".
/// </summary>
internal sealed class BackofficeAnnouncementTelemetryContributor : ITelemetryContributor
{
    public const string Product = "backoffice-announcement";

    private readonly IWebHostEnvironment _env;
    private readonly TelemetryPayloadBuilder _builder;
    private readonly IConfiguration _configuration;

    public BackofficeAnnouncementTelemetryContributor(IWebHostEnvironment env, TelemetryPayloadBuilder builder, IConfiguration configuration)
    {
        _env = env;
        _builder = builder;
        _configuration = configuration;
    }

    public string ProductId => Product;

    public string? PackageVersion => TelemetryPayloadBuilder.VersionOf(typeof(BackofficeAnnouncementTelemetryContributor).Assembly);

    public bool IsEnabled()
        => _configuration.GetValue<bool?>("BackofficeAnnouncement:Telemetry:Enabled") != false
           && _builder.IsProductToggleOn(Product);

    public void Contribute(TelemetryReport report)
    {
        var all = BackofficeAnnouncementController.ReadStored(_env.ContentRootPath).Announcements;
        report.SizeBand["announcements"] = TelemetryBand.Of(all.Count);
        report.SizeBand["enabled"] = TelemetryBand.Of(all.Count(a => a.Enabled));
        report.Features["targeted"] = all.Any(a => a.TargetUserGroups.Count > 0);
        report.Features["nonDismissible"] = all.Any(a => !a.AllowDismiss);
    }
}
