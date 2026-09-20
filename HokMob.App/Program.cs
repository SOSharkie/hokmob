using HokMob.App.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllersWithViews();
// Every cache entry sets a Size (see NhlApiClient, NhlStatsApiClient, NhlSearchApiClient); this bounds the total to
// about 150 MB, safe for both the 1 GB (F1) and 1.75 GB (B1) Azure App Service quotas the app runs on.
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 150 * 1024 * 1024;
});
builder.Services.AddScoped<NhlSeasonService>();
builder.Services.AddHttpClient<NhlApiClient>(client =>
{
    client.BaseAddress = new Uri(NhlApiClient.BaseUrl);
    // Longer than the other two: api-web serves the current day's score/{date} from its origin with no-store, and
    // a struggling origin takes anywhere from 3 to 20 seconds. At 10s a good chunk of those became 502s with
    // nothing cached to fall back on yet (see "Surviving an api-web outage" in docs/nhl-api.md). Callers sharing an
    // in-flight request wait this long before the last known good copy is served, so it is a ceiling, not a target.
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HokMob/1.0");
});
builder.Services.AddHttpClient<NhlStatsApiClient>(client =>
{
    client.BaseAddress = new Uri(NhlStatsApiClient.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HokMob/1.0");
});
builder.Services.AddHttpClient<NhlSearchApiClient>(client =>
{
    client.BaseAddress = new Uri(NhlSearchApiClient.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HokMob/1.0");
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();


app.MapControllerRoute(
    name: "default",
    pattern: "{controller}/{action=Index}/{id?}");

app.MapFallbackToFile("index.html");

app.Run();
