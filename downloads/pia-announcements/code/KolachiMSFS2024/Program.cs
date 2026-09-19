using NAudio.Wave;

var baseUrl = "http://127.0.0.1:1947";
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .Build();

var soundFolderSetting = configuration["KolachiMSFS2024:SoundFolder"];
if (string.IsNullOrWhiteSpace(soundFolderSetting))
{
    throw new InvalidOperationException(
    "KolachiMSFS2024:SoundFolder must be configured in appsettings.json.");
}

var soundFolder = Path.GetFullPath(
    Environment.ExpandEnvironmentVariables(soundFolderSetting),
    AppContext.BaseDirectory);

using var player = new Mp3Player(soundFolder);

if (args.Length > 0 && !args[0].Equals("--serve", StringComparison.OrdinalIgnoreCase))
{
    await player.PlayToEndAsync(args[0]);
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();

var app = builder.Build();
Console.WriteLine("Kolachi Companion App is running.");
Console.WriteLine($"Listening at {baseUrl}");
Console.WriteLine("...");
Console.WriteLine("To test an announcement, use the /api/v1/playAnnouncements endpoint.");
Console.WriteLine($"Example: \"{baseUrl}/api/v1/playAnnouncements?name=chime\"");
Console.WriteLine("");
Console.WriteLine("Other announcements can be played by changing the 'name' query parameter,");
Console.WriteLine("e.g., PIA-Arrival, PIA-Descent, PIA-Landing, etc.");

app.Use(async (context, next) =>
{
    context.Response.Headers.AccessControlAllowOrigin = "*";
    context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
    context.Response.Headers.AccessControlAllowHeaders = "Content-Type";

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.MapMethods("/api/v1/playAnnouncements", ["GET", "POST"], (HttpRequest request) =>
{
    var name = request.Query["name"].FirstOrDefault()
        ?? request.Query["announcementType"].FirstOrDefault();

    try
    {
        var fileName = player.Play(name);
        return Results.Ok(new { playing = Path.GetFileNameWithoutExtension(fileName), folder = soundFolder });
    }
    catch (ArgumentException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
    catch (FileNotFoundException exception)
    {
        return Results.NotFound(new { error = exception.Message });
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ready", soundFolder }));
app.Run(baseUrl);

sealed class Mp3Player : IDisposable
{
    private readonly string soundFolder;
    private readonly object syncRoot = new();
    private WaveOutEvent? output;
    private AudioFileReader? reader;

    public Mp3Player(string soundFolder)
    {
        this.soundFolder = soundFolder;

        if (!Directory.Exists(soundFolder))
        {
            throw new DirectoryNotFoundException($"Sound folder not found: {soundFolder}");
        }
    }

    public string Play(string? name)
    {
        var path = ResolvePath(name);

        lock (syncRoot)
        {
            StopCurrent();

            reader = new AudioFileReader(path);
            output = new WaveOutEvent();
            output.Init(reader);
            output.Play();
        }

        return Path.GetFileName(path);
    }

    public async Task PlayToEndAsync(string name)
    {
        var stopped = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Play(name);

        lock (syncRoot)
        {
            output!.PlaybackStopped += (_, eventArgs) =>
            {
                if (eventArgs.Exception is not null)
                {
                    stopped.TrySetException(eventArgs.Exception);
                }
                else
                {
                    stopped.TrySetResult();
                }
            };
        }

        await stopped.Task;
    }

    private string ResolvePath(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)
            || !string.Equals(name, Path.GetFileName(name), StringComparison.Ordinal)
            || Path.HasExtension(name))
        {
            throw new ArgumentException("Pass only an MP3 filename without its extension.");
        }

        var path = Directory.EnumerateFiles(soundFolder, "*.mp3")
            .FirstOrDefault(file => string.Equals(
                Path.GetFileNameWithoutExtension(file),
                name,
                StringComparison.OrdinalIgnoreCase));

        return path ?? throw new FileNotFoundException($"No MP3 named '{name}' was found.");
    }

    private void StopCurrent()
    {
        output?.Stop();
        output?.Dispose();
        reader?.Dispose();
        output = null;
        reader = null;
    }

    public void Dispose()
    {
        lock (syncRoot)
        {
            StopCurrent();
        }
    }
}