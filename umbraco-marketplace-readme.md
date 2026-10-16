# Backoffice Announcement

A backoffice announcement bar for Umbraco 13 - 17. Toggle on/off a simple text announcement visible to all backoffice users.

## Features
- Toggle an announcement bar on/off from the Settings dashboard
- Set a custom text message displayed to all backoffice users
- Settings stored as a JSON file in App_Data (no database required)
- Lightweight status endpoint for polling

## Compatibility
- Umbraco 13, 14, 15, 16, 17
- .NET 8.0
- .NET 9.0
- .NET 10.0

## Installation
- Install via NuGet https://www.nuget.org/packages/DigitalWonderlab.BackofficeAnnouncement/latest
- Go to Settings and click the Backoffice Announcement tab
- Toggle the announcement on/off and set your message

## Telemetry (1.1.0)
Once a day Backoffice Announcement sends us a small anonymous report so we know how many sites use it
and on which versions. It is on by default and easy to turn off.

- **Sent:** a random install ID (created on first run, stored in your Umbraco database, not derived from anything
  about your site), the package, Umbraco and .NET versions, environment type, hosting type, database type, how many
  announcements exist and are enabled (in bands such as `1-9`), and whether user-group targeting or non-dismissible
  announcements are used.
- **Never sent:** the announcement text, colours, user groups, hostnames, URLs, user names, emails or IP addresses.
- **See it / turn it off:** the dashboard's **Settings** tab shows exactly what is sent and has an on/off switch. Or set
  `"BackofficeAnnouncement": { "Telemetry": { "Enabled": false } }`, or `"DigitalWonderlab": { "Telemetry": { "Enabled": false } }`
  for every Digital Wonderlab package.
- Local development (`ASPNETCORE_ENVIRONMENT=Development`) never sends anything. Data is kept for 13 months.

## Issues / Suggestions
- To report an issue or suggest a feature please use the GitHub issue tracker - https://github.com/dwlkev/DigitalWonderlab.BackofficeAnnouncement/issues

## Screenshots
![Dashboard](https://i.postimg.cc/wTbW3HFg/announcement2.png)
