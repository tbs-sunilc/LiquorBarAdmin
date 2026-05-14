using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Domain.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-12 Platform Analytics.  One endpoint returns everything on the page —
/// top-line KPIs, top-bars leaderboard, and the city-bubble map rows.  The
/// window defaults to the last 30 days (IST calendar); callers can override.
/// </summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/analytics")]
[Produces("application/json")]
public sealed class AdminAnalyticsController : ControllerBase
{
    private const int TopBarsTake = 10;

    private readonly IPlatformAnalyticsRepository _analytics;
    private readonly TimeProvider _clock;

    public AdminAnalyticsController(IPlatformAnalyticsRepository analytics, TimeProvider clock)
    {
        _analytics = analytics;
        _clock = clock;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PlatformAnalyticsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PlatformAnalyticsDto>> Get(
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        // Default window: last 30 IST days including today.
        var istNow = _clock.GetUtcNow().UtcDateTime.AddHours(5.5);
        var defaultTo = DateOnly.FromDateTime(istNow);
        var defaultFrom = defaultTo.AddDays(-29);
        var fromDate = from ?? defaultFrom;
        var toDate = to ?? defaultTo;

        var fromUtc = fromDate.ToDateTime(TimeOnly.MinValue).AddHours(-5.5);
        var toUtc = toDate.AddDays(1).ToDateTime(TimeOnly.MinValue).AddHours(-5.5);

        var gmvTask      = _analytics.GetPlatformGmvInPaiseAsync(fromUtc, toUtc, ct);
        var txnTask      = _analytics.GetPlatformTransactionCountAsync(fromUtc, toUtc, ct);
        var uniqTask     = _analytics.GetPlatformUniqueCustomersAsync(fromUtc, toUtc, ct);
        var barCountTask = _analytics.GetActiveBarCountAsync(ct);
        var topBarsTask  = _analytics.GetTopBarsAsync(fromUtc, toUtc, TopBarsTake, ct);
        var citiesTask   = _analytics.GetCityAggregatesAsync(fromUtc, toUtc, ct);

        await Task.WhenAll(gmvTask, txnTask, uniqTask, barCountTask, topBarsTask, citiesTask);

        var topBars = topBarsTask.Result.Select(r => new BarLeaderboardDto(
            BarId: r.BarId, BarName: r.BarName, City: r.City, StateCode: r.StateCode,
            GmvInPaise: r.GmvInPaise, TransactionCount: r.TransactionCount)).ToList();

        var cities = citiesTask.Result.Select(r => new CityBubbleDto(
            City: r.City, StateCode: r.StateCode, BarCount: r.BarCount,
            GmvInPaise: r.GmvInPaise,
            Latitude: r.CentroidLatitude, Longitude: r.CentroidLongitude)).ToList();

        return Ok(new PlatformAnalyticsDto(
            FromDate:            fromDate,
            ToDate:              toDate,
            GmvInPaise:          gmvTask.Result,
            TransactionCount:    txnTask.Result,
            UniqueCustomerCount: uniqTask.Result,
            ActiveBarCount:      barCountTask.Result,
            TopBars:             topBars,
            CityMap:             cities));
    }
}
