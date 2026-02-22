using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Umbraco.Cms.Core.Services;

[ApiController]
[Route("umbraco/api/backofficeannouncement")]
public class BackofficeAnnouncementController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

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
    public IActionResult GetSettings()
    {
        var settings = ReadSettings();
        return Ok(settings);
    }

    [HttpPost("settings")]
    public IActionResult SaveSettings([FromBody] AnnouncementSettings settings)
    {
        WriteSettings(settings);
        return Ok(settings);
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        var settings = ReadSettings();
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
