using DigitalWonderlab.Telemetry;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace DigitalWonderlab.BackofficeAnnouncement;

/// <summary>Registers the anonymous daily telemetry heartbeat (see README "Telemetry").</summary>
public class BackofficeAnnouncementComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
        => builder.Services.AddDwlTelemetryProduct<BackofficeAnnouncementTelemetryContributor>();
}
