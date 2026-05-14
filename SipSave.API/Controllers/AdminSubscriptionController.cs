using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Domain.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-05 platform-admin subscription listing.  Read-only — subscription
/// lifecycle (create, cancel, renewals) is driven by bar-owners + Razorpay
/// webhooks, not admins.  This controller exposes the cross-bar view the
/// support team uses to diagnose failed payments.
/// </summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/subscriptions")]
[Produces("application/json")]
public sealed class AdminSubscriptionController : ControllerBase
{
    private readonly IBarSubscriptionRepository _subs;
    private readonly IBarRepository _bars;

    public AdminSubscriptionController(IBarSubscriptionRepository subs, IBarRepository bars)
    {
        _subs = subs;
        _bars = bars;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AdminSubscriptionRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminSubscriptionRowDto>>> Get(
        [FromQuery] string? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        if (take <= 0 || take > 200) take = 50;
        if (skip < 0) skip = 0;
        var rows = await _subs.GetAllForAdminAsync(status, skip, take, ct);
        var dtos = new List<AdminSubscriptionRowDto>(rows.Count);
        foreach (var s in rows)
        {
            var bar = await _bars.GetByIdAsync(s.BarId, ct);
            dtos.Add(new AdminSubscriptionRowDto(
                Id:                   s.Id,
                BarId:                s.BarId,
                BarName:              bar?.BusinessName ?? "—",
                SubscriptionPlanId:   s.SubscriptionPlanId,
                Status:               s.Status,
                BillingCycle:         s.BillingCycle,
                PriceInPaiseAtSignup: s.PriceInPaiseAtSignup,
                StartedAt:            s.StartedAt,
                CurrentPeriodStart:   s.CurrentPeriodStart,
                CurrentPeriodEnd:     s.CurrentPeriodEnd,
                NextBillingAtUtc:     s.NextBillingAt,
                GracePeriodEndsAtUtc: s.GracePeriodEndsAt,
                FailedPaymentCount:   s.FailedPaymentCount,
                LastFailureReason:    s.LastFailureReason));
        }
        return Ok(dtos);
    }
}
