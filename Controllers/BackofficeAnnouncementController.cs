using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using DigitalWonderlab.BackofficeAnnouncement;
using DigitalWonderlab.Telemetry;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Authorization;

// SECURITY (1.0.4): up to 1.0.3 this controller had no authorisation, so anyone could read and overwrite the
// announcements, and an unescaped colour value let them inject script into every backoffice user's session.
// Now: signed-in backoffice users only (status/usergroups, used by the bar on every page); settings read/write
// needs admin (15+) or Settings-section access (13/14); saved values are validated.
// Umbraco 13 only runs backoffice cookie auth on /umbraco/backoffice/*, so the v13 scripts use the second route.
[ApiController]
[Route("umbraco/api/backofficeannouncement")]
[Route("umbraco/backoffice/backofficeannouncement")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
public class BackofficeAnnouncementController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    // The dashboard is admin-only; the API matches that where Umbraco has an admin policy (15+).
    // Umbraco 13/14 (net8 build) have no RequireAdminAccess policy, so they need Settings-section access.
#if NET9_0_OR_GREATER
    private const string SettingsPolicy = AuthorizationPolicies.RequireAdminAccess;
#else
    private const string SettingsPolicy = AuthorizationPolicies.SectionAccessSettings;
#endif

    private readonly IWebHostEnvironment _env;

#if NET10_0_OR_GREATER
    private readonly IUserGroupService _userGroupService;

    public BackofficeAnnouncementController(IWebHostEnvironment env, IUserGroupService userGroupService)
    {
        _env = env;
        _userGroupService = userGroupService;
    }
#else
    private readonly IUserService _userService;

    public BackofficeAnnouncementController(IWebHostEnvironment env, IUserService userService)
    {
        _env = env;
        _userService = userService;
    }
#endif

    private string SettingsFilePath =>
        Path.Combine(_env.ContentRootPath, "App_Data", "BackofficeAnnouncement", "settings.json");

    private AnnouncementSettings ReadSettings()
    {
        var path = SettingsFilePath;
        if (!System.IO.File.Exists(path))
            return new AnnouncementSettings();

        var json = System.IO.File.ReadAllText(path);
        var settings = JsonSerializer.Deserialize<AnnouncementSettings>(json, JsonOptions);

        // Migrate from old single-announcement format
        if (settings != null && settings.Announcements.Count == 0 && !string.IsNullOrEmpty(settings.Message))
        {
            settings.Announcements.Add(new Announcement
            {
                Enabled = settings.Enabled,
                Message = settings.Message,
                AllowDismiss = settings.AllowDismiss,
                BackgroundColor = settings.BackgroundColor,
                TextColor = settings.TextColor
            });
            settings.Message = null;
        }

        return settings ?? new AnnouncementSettings();
    }

    private void WriteSettings(AnnouncementSettings settings)
    {
        var path = SettingsFilePath;
        var dir = Path.GetDirectoryName(path)!;
        if (!Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        var json = JsonSerializer.Serialize(settings, JsonOptions);
        System.IO.File.WriteAllText(path, json);
    }

    [HttpGet("settings")]
    [Authorize(Policy = SettingsPolicy)]
    public IActionResult GetSettings()
    {
        var settings = ReadSettings();
        return Ok(settings);
    }

    [HttpPost("settings")]
    [Authorize(Policy = SettingsPolicy)]
    [RequestSizeLimit(64 * 1024)]
    public IActionResult SaveSettings([FromBody] AnnouncementSettings settings)
    {
        var clean = Sanitise(settings);
        WriteSettings(clean);
        return Ok(clean);
    }

    private const int MaxAnnouncements = 20;
    private const int MaxMessageLength = 1000;
    private static readonly Regex Colour = new("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", RegexOptions.Compiled);
    private static readonly Regex SafeToken = new("^[A-Za-z0-9_.-]{1,100}$", RegexOptions.Compiled);

    /// <summary>
    /// Only well-formed values are stored, so nothing saved can break out of an HTML attribute in the bar:
    /// colours must be hex, ids and user-group aliases plain tokens, messages bounded (and always rendered as text).
    /// </summary>
    private static AnnouncementSettings Sanitise(AnnouncementSettings? input)
    {
        var output = new AnnouncementSettings();
        foreach (var a in (input?.Announcements ?? new List<Announcement>()).Take(MaxAnnouncements))
        {
            var message = (a.Message ?? string.Empty).Trim();
            output.Announcements.Add(new Announcement
            {
                Id = SafeToken.IsMatch(a.Id ?? string.Empty) ? a.Id! : Guid.NewGuid().ToString(),
                Enabled = a.Enabled,
                Message = message.Length > MaxMessageLength ? message[..MaxMessageLength] : message,
                AllowDismiss = a.AllowDismiss,
                BackgroundColor = Colour.IsMatch(a.BackgroundColor ?? string.Empty) ? a.BackgroundColor : "#1b264f",
                TextColor = Colour.IsMatch(a.TextColor ?? string.Empty) ? a.TextColor : "#ffffff",
                TargetUserGroups = (a.TargetUserGroups ?? new List<string>())
                    .Where(g => SafeToken.IsMatch(g ?? string.Empty)).Distinct().Take(50).ToList(),
            });
        }
        return output;
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        // Sanitised on read too, so a settings file written by 1.0.3 or earlier cannot carry an injection.
        var settings = Sanitise(ReadSettings());
        var active = settings.Announcements
            .Where(a => a.Enabled && !string.IsNullOrWhiteSpace(a.Message))
            .ToList();

        // Return all active announcements including targetUserGroups
        // so the client-side JS can filter based on the current user's groups
        return Ok(active.Select(a => new
        {
            id = a.Id,
            message = a.Message,
            allowDismiss = a.AllowDismiss,
            backgroundColor = a.BackgroundColor,
            textColor = a.TextColor,
            targetUserGroups = a.TargetUserGroups ?? new List<string>()
        }).ToList());
    }

    public record TelemetryToggleRequest(bool Enabled);

    [HttpGet("telemetry")]
    [Authorize(Policy = SettingsPolicy)]
    public IActionResult GetTelemetry()
    {
        var builder = HttpContext.RequestServices.GetRequiredService<TelemetryPayloadBuilder>();
        return Ok(new { enabled = builder.IsProductToggleOn(BackofficeAnnouncementTelemetryContributor.Product) });
    }

    // No [Consumes]: on Umbraco 14 / .NET 8 it made the GET twin on the same route 404.
    [HttpPost("telemetry")]
    [Authorize(Policy = SettingsPolicy)]
    public IActionResult SaveTelemetry([FromBody] TelemetryToggleRequest request)
    {
        var builder = HttpContext.RequestServices.GetRequiredService<TelemetryPayloadBuilder>();
        builder.SetProductToggle(BackofficeAnnouncementTelemetryContributor.Product, request.Enabled);
        return Ok(new { enabled = request.Enabled });
    }

    /// <summary>The exact heartbeat this site would send next, shown on the dashboard's Settings tab.</summary>
    [HttpGet("telemetry/preview")]
    [Authorize(Policy = SettingsPolicy)]
    public IActionResult PreviewTelemetry()
    {
        var builder = HttpContext.RequestServices.GetRequiredService<TelemetryPayloadBuilder>();
        var contributor = HttpContext.RequestServices.GetServices<ITelemetryContributor>()
            .First(c => c.ProductId == BackofficeAnnouncementTelemetryContributor.Product);
        return Ok(new
        {
            endpoint = builder.Endpoint,
            enabled = builder.GloballyEnabled && contributor.IsEnabled(),
            environmentAllowed = builder.EnvironmentAllowed,
            payload = builder.Build(contributor)
        });
    }

    /// <summary>Settings as currently stored (sanitised), for the telemetry contributor.</summary>
    internal static AnnouncementSettings ReadStored(string contentRootPath)
    {
        var path = Path.Combine(contentRootPath, "App_Data", "BackofficeAnnouncement", "settings.json");
        if (!System.IO.File.Exists(path)) return new AnnouncementSettings();
        try { return Sanitise(JsonSerializer.Deserialize<AnnouncementSettings>(System.IO.File.ReadAllText(path), JsonOptions)); }
        catch { return new AnnouncementSettings(); }
    }

#if NET10_0_OR_GREATER
    [HttpGet("usergroups")]
    public async Task<IActionResult> GetUserGroups()
    {
        var result = await _userGroupService.GetAllAsync(0, 100);
        var groups = result.Items
            .Select(g => new
            {
                alias = g.Alias,
                name = g.Name,
                icon = g.Icon,
                key = g.Key.ToString()
            })
            .OrderBy(g => g.name)
            .ToList();

        return Ok(groups);
    }
#else
    [HttpGet("usergroups")]
    public IActionResult GetUserGroups()
    {
#pragma warning disable CS0618 // Obsolete in v15-16, removed in v17
        var groups = _userService.GetAllUserGroups()
#pragma warning restore CS0618
            .Select(g => new
            {
                alias = g.Alias,
                name = g.Name,
                icon = g.Icon,
                key = g.Key.ToString()
            })
            .OrderBy(g => g.name)
            .ToList();

        return Ok(groups);
    }
#endif
}

public class AnnouncementSettings
{
    public List<Announcement> Announcements { get; set; } = new();

    // Legacy fields for migration from old single-announcement format
    [Obsolete("Use Announcements list")]
    public bool Enabled { get; set; }
    [Obsolete("Use Announcements list")]
    public string? Message { get; set; }
    [Obsolete("Use Announcements list")]
    public bool AllowDismiss { get; set; } = true;
    [Obsolete("Use Announcements list")]
    public string BackgroundColor { get; set; } = "#1b264f";
    [Obsolete("Use Announcements list")]
    public string TextColor { get; set; } = "#ffffff";
}

public class Announcement
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public bool Enabled { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool AllowDismiss { get; set; } = true;
    public string BackgroundColor { get; set; } = "#1b264f";
    public string TextColor { get; set; } = "#ffffff";
    public List<string> TargetUserGroups { get; set; } = new();

    // Legacy field for backward compatibility
    [Obsolete("Use TargetUserGroups list")]
    public string? TargetUserGroup { get; set; }
}
