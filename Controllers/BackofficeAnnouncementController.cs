using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.Json;

[ApiController]
[Route("umbraco/api/backofficeannouncement")]
public class BackofficeAnnouncementController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public BackofficeAnnouncementController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string SettingsFilePath =>
        Path.Combine(_env.ContentRootPath, "App_Data", "BackofficeAnnouncement", "settings.json");

    private AnnouncementSettings ReadSettings()
    {
        var path = SettingsFilePath;
        if (!System.IO.File.Exists(path))
            return new AnnouncementSettings();

        var json = System.IO.File.ReadAllText(path);
        return JsonSerializer.Deserialize<AnnouncementSettings>(json) ?? new AnnouncementSettings();
    }

    private void WriteSettings(AnnouncementSettings settings)
    {
        var path = SettingsFilePath;
        var dir = Path.GetDirectoryName(path)!;
        if (!Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
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
        return Ok(new { enabled = settings.Enabled, message = settings.Message });
    }
}

public class AnnouncementSettings
{
    public bool Enabled { get; set; }
    public string Message { get; set; } = string.Empty;
}
