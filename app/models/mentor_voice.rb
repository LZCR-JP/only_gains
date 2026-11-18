require "open3"
require "digest"

# Neural voice-overs for the 3D mentor stage, generated with edge-tts
# (https://github.com/rany2/edge-tts): free, no API key. It uses Microsoft Edge's
# online read-aloud service, so the server needs internet access the first time
# each line is generated. After that the MP3 is served from tmp/cache/mentor_voices/.
#
# Install once:  pip3 install --user edge-tts   (or: pipx install edge-tts)
# Pre-generate:  bin/rails mentor_voices:warm
# Custom binary: EDGE_TTS_BIN=/path/to/edge-tts
#
# If edge-tts is missing or fails, MentorVoice::Unavailable is raised and the
# browser falls back to its built-in speechSynthesis.
class MentorVoice
  class Unavailable < StandardError; end

  CACHE_DIR = Rails.root.join("tmp/cache/mentor_voices")
  TIMEOUT = 20 # seconds per generation

  # The single source of truth for each coach's voice and lines.
  # Only these exact quotes can be spoken (the endpoint is not a general TTS proxy).
  PROFILES = {
    "goggins" => {
      voice: "en-US-ChristopherNeural", pitch: "-10Hz", rate: "+5%",
      quotes: [
        "Who's gonna carry the boats?!",
        "Stay hard!",
        "Don't stop when you're tired. Stop when you're done."
      ]
    },
    "arnold" => {
      # Austrian accent; swap to "en-US-GuyNeural" for a US voice
      voice: "de-AT-JonasNeural", pitch: "-15Hz", rate: "-10%",
      quotes: [
        "Milk is for babies! Drink protein shake and lift heavy!",
        "The last three or four reps is what makes the muscle grow.",
        "I'll be back… for another set."
      ]
    },
    "yoda" => {
      voice: "en-GB-RyanNeural", pitch: "-12Hz", rate: "-18%",
      quotes: [
        "Do or do not. There is no try.",
        "Size matters not.",
        "Patience you must have, young lifter."
      ]
    },
    "sonic" => {
      voice: "en-US-AndrewNeural", pitch: "+15Hz", rate: "+20%",
      quotes: [
        "Gotta go fast!",
        "Too slow!",
        "Way past cool!"
      ]
    },
    "mikasa" => {
      voice: "en-US-JennyNeural", pitch: "+2Hz", rate: "-5%",
      quotes: [
        "If you win, you live. If you lose, you die.",
        "This world is cruel… but also very beautiful.",
        "Fight! Fight!"
      ]
    },
    "jonah" => {
      voice: "en-US-EricNeural", pitch: "+0Hz", rate: "+0%",
      quotes: [
        "Gloves on, phone down.",
        "We're not chasing perfect — we're chasing Tuesday.",
        "Small wins still count. Be kind to yourself."
      ]
    }
  }.freeze

  # Mentor#name → profile key, e.g. 'Arnold “The Oak”' → "arnold"
  def self.slug_for(name)
    PROFILES.keys.find { |slug| name.to_s.downcase.include?(slug) }
  end

  def self.quotes_for(name)
    PROFILES.dig(slug_for(name), :quotes) || []
  end

  # Path to the cached MP3 for this line, generating it on first use.
  def self.audio_path(slug, text)
    profile = PROFILES.fetch(slug)
    raise ArgumentError, "unknown quote" unless profile[:quotes].include?(text)

    path = CACHE_DIR.join("#{slug}-#{Digest::SHA256.hexdigest([profile[:voice], profile[:pitch], profile[:rate], text].join('|'))[0, 20]}.mp3")
    generate(profile, text, path) unless path.exist? && path.size.positive?
    path
  end

  def self.generate(profile, text, path)
    raise Unavailable, "edge-tts recently failed; using browser voice" if recently_failed?

    FileUtils.mkdir_p(CACHE_DIR)
    partial = "#{path}.#{SecureRandom.hex(6)}.part" # write then rename: no half-written files
    args = ["--voice", profile[:voice], "--pitch=#{profile[:pitch]}", "--rate=#{profile[:rate]}",
            "--text", text, "--write-media", partial]

    command_candidates.each do |command|
      ok = run(command + args)
      if ok && File.size?(partial)
        File.rename(partial, path)
        @command = command
        return
      end
    rescue Errno::ENOENT
      next # this candidate isn't installed; try the next one
    ensure
      FileUtils.rm_f(partial)
    end

    @failed_at = Time.current
    raise Unavailable, "edge-tts is not installed or could not reach the voice service"
  end

  # Runs without a shell (arguments are passed as an array) and with a timeout.
  def self.run(argv)
    Open3.popen3(*argv) do |stdin, stdout, stderr, wait|
      stdin.close
      readers = [stdout, stderr].map { |io| Thread.new { io.read } }
      unless wait.join(TIMEOUT)
        Process.kill("KILL", wait.pid)
        Rails.logger.warn("[MentorVoice] edge-tts timed out after #{TIMEOUT}s")
        return false
      end
      error = readers.last.value
      Rails.logger.warn("[MentorVoice] edge-tts failed: #{error.to_s.lines.last}") unless wait.value.success?
      wait.value.success?
    end
  end

  def self.command_candidates
    return [@command] if @command

    [
      (ENV["EDGE_TTS_BIN"].split if ENV["EDGE_TTS_BIN"].present?),
      ["edge-tts"],
      ["python3", "-m", "edge_tts"] # works even when pip's bin folder isn't on PATH
    ].compact
  end

  # After a failure, skip edge-tts for a minute instead of spawning it on every request
  def self.recently_failed?
    @failed_at && @failed_at > 1.minute.ago
  end
end
