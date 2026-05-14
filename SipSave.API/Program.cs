using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using SipSave.API.Hubs;
using SipSave.API.Middleware;
using SipSave.Infrastructure.DependencyInjection;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/sipsave-.log", rollingInterval: RollingInterval.Day)
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File("logs/sipsave-.log", rollingInterval: RollingInterval.Day));

    var cfg = builder.Configuration;

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddOpenApi();

    var jwtSecret = cfg["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
    var jwtIssuer = cfg["Jwt:Issuer"] ?? "SipSave";
    var jwtAudience = cfg["Jwt:Audience"] ?? "SipSave.Clients";

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };

            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var accessToken = ctx.Request.Query["access_token"];
                    var path = ctx.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        ctx.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });

    builder.Services.AddAuthorization();

    const string CorsPolicy = "SipSaveClients";
    builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p => p
        .WithOrigins("http://localhost:3000", "http://localhost:3001")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

    builder.Services.AddSignalR();

    // Phase 5 — SignalR broadcaster for the PourHub. Registered here (not in
    // InfrastructureModule) because it depends on IHubContext, a SignalR type.
    builder.Services.AddSingleton<SipSave.Application.Interfaces.IPourHubBroadcaster, SipSave.API.Hubs.PourHubBroadcaster>();

    // IntegrationTest env skips Hangfire — WebApplicationFactory can't reach
    // SQL Server, and scheduled jobs aren't the subject under test.
    var isIntegrationTest = builder.Environment.IsEnvironment("IntegrationTest");
    if (!isIntegrationTest)
    {
        var hangfireConn = cfg.GetConnectionString("SipSave")
            ?? throw new InvalidOperationException("ConnectionStrings:SipSave is not configured.");
        builder.Services.AddHangfire(c => c
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(hangfireConn, new SqlServerStorageOptions
            {
                CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
                SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
                QueuePollInterval = TimeSpan.Zero,
                UseRecommendedIsolationLevel = true,
                DisableGlobalLocks = true
            }));
        builder.Services.AddHangfireServer();
    }

    builder.Services.AddFluentValidationAutoValidation();
    builder.Services.AddValidatorsFromAssembly(typeof(SipSave.Application.AssemblyMarker).Assembly);

    builder.Services.AddSipSaveInfrastructure(builder.Configuration);

    var app = builder.Build();

    app.UseMiddleware<GlobalExceptionMiddleware>();

    app.UseSerilogRequestLogging();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
    }
    else
    {
        app.UseHttpsRedirection();
    }

    app.UseRouting();
    app.UseCors(CorsPolicy);
    app.UseAuthentication();
    app.UseAuthorization();

    if (!isIntegrationTest)
    {
        app.UseHangfireDashboard("/hangfire");
    }
    app.MapControllers();
    app.MapHub<NotificationsHub>("/hubs/notifications");
    app.MapHub<PourHub>("/hubs/pour");

    if (!isIntegrationTest)
    {
        // Phase 4 recurring jobs. Cron schedules expressed in UTC:
        //   02:00 IST = 20:30 UTC → Gift auto-refund sweep (BR-043)
        //   10:00 IST = 04:30 UTC → Wallet expiry reminders (BR-019 / BR-020)
        RecurringJob.AddOrUpdate<SipSave.Application.Jobs.GiftAutoRefundJob>(
            "gift-auto-refund",
            job => job.RunAsync(CancellationToken.None),
            "30 20 * * *");
        RecurringJob.AddOrUpdate<SipSave.Application.Jobs.WalletExpiryWarningJob>(
            "wallet-expiry-warnings",
            job => job.RunAsync(CancellationToken.None),
            "30 4 * * *");

        // Phase 5 — BR-022 idle sessions (> 6 hours) flip to AutoClosed every 15 min.
        RecurringJob.AddOrUpdate<SipSave.Application.Jobs.SessionAutoCloseJob>(
            "session-auto-close",
            job => job.RunAsync(CancellationToken.None),
            "*/15 * * * *");

        // Phase 9 — BR-046 subscription de-listing. 06:00 IST = 00:30 UTC.
        RecurringJob.AddOrUpdate<SipSave.Application.Jobs.SubscriptionGracePeriodJob>(
            "subscription-grace",
            job => job.RunAsync(CancellationToken.None),
            "30 0 * * *");
    }

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "SipSave API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Makes the implicit top-level `Program` type visible to
// `WebApplicationFactory<Program>` in SipSave.IntegrationTests.
public partial class Program;
