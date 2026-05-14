using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-03 / SC-04 KYC review.  Locked to the <c>admin</c> role; finer role
/// gating (e.g., <c>KycReviewer</c> only) lives on the role policy in
/// Program.cs once the admin policy registry lands in Phase 8.5.
/// </summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/kyc")]
[Produces("application/json")]
public sealed class AdminKycController : ControllerBase
{
    private readonly IAdminKycService _kyc;

    public AdminKycController(IAdminKycService kyc)
    {
        _kyc = kyc;
    }

    /// <summary>GET /api/admin/kyc?status=PendingReview&amp;skip=0&amp;take=50 — SC-03 queue.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<KycQueueRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<KycQueueRowDto>>> GetQueue(
        [FromQuery] string? status = "PendingReview",
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var rows = await _kyc.GetQueueAsync(status, skip, take, ct);
        return Ok(rows);
    }

    /// <summary>GET /api/admin/kyc/:userId — SC-04 detail (signed doc URL inside).</summary>
    [HttpGet("{userId:int}")]
    [ProducesResponseType(typeof(KycReviewDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KycReviewDetailDto>> GetDetail(int userId, CancellationToken ct)
    {
        var detail = await _kyc.GetDetailAsync(userId, ct);
        return detail is null ? NotFound() : Ok(detail);
    }

    /// <summary>POST /api/admin/kyc/:userId/approve — SC-04 approve modal.</summary>
    [HttpPost("{userId:int}/approve")]
    [ProducesResponseType(typeof(KycReviewDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KycReviewDetailDto>> Approve(
        int userId, [FromBody] ApproveKycRequest request, CancellationToken ct) =>
        Ok(await _kyc.ApproveAsync(userId, request, AdminId(), ct));

    /// <summary>POST /api/admin/kyc/:userId/reject — SC-04 reject modal (reason required).</summary>
    [HttpPost("{userId:int}/reject")]
    [ProducesResponseType(typeof(KycReviewDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<KycReviewDetailDto>> Reject(
        int userId, [FromBody] RejectKycRequest request, CancellationToken ct) =>
        Ok(await _kyc.RejectAsync(userId, request, AdminId(), ct));

    /// <summary>POST /api/admin/kyc/:userId/resubmit — SC-04 ask-for-resubmit modal.</summary>
    [HttpPost("{userId:int}/resubmit")]
    [ProducesResponseType(typeof(KycReviewDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KycReviewDetailDto>> Resubmit(
        int userId, [FromBody] ResubmitKycRequest request, CancellationToken ct) =>
        Ok(await _kyc.RequestResubmitAsync(userId, request, AdminId(), ct));

    private int AdminId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim missing or malformed.");
        return id;
    }
}
