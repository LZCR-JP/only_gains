namespace :mentor_voices do
  desc "Pre-generate every mentor quote with edge-tts into tmp/cache/mentor_voices/"
  task warm: :environment do
    MentorVoice::PROFILES.each do |slug, profile|
      profile[:quotes].each do |text|
        path = MentorVoice.audio_path(slug, text)
        puts "#{slug.ljust(8)} #{File.basename(path)}  #{text}"
      end
    end
  rescue MentorVoice::Unavailable => e
    abort "edge-tts unavailable: #{e.message}\nInstall it with: pip3 install --user edge-tts"
  end

  desc "Delete cached mentor voice-overs (regenerated on next request)"
  task clear: :environment do
    FileUtils.rm_rf(MentorVoice::CACHE_DIR)
    puts "Cleared #{MentorVoice::CACHE_DIR}"
  end
end
