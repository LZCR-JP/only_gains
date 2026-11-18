require "test_helper"

class MentorVoicesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = User.create!(email: "voice-test-#{SecureRandom.hex(4)}@example.com", password: "password123")
    @audio = Rails.root.join("tmp/test-voice-#{SecureRandom.hex(4)}.mp3")
    File.binwrite(@audio, "ID3fake-mp3")
  end

  teardown { FileUtils.rm_f(@audio) }

  # Temporarily replace MentorVoice.audio_path (no edge-tts or network in tests)
  def with_audio_path(fake)
    original = MentorVoice.method(:audio_path)
    MentorVoice.define_singleton_method(:audio_path) { |*args| fake.call(*args) }
    yield
  ensure
    MentorVoice.define_singleton_method(:audio_path, original)
  end

  test "requires sign in" do
    post mentor_voice_path, params: { mentor_slug: "yoda", text: "Size matters not." }
    assert_redirected_to new_user_session_path
  end

  test "returns the cached mp3 for a known quote" do
    sign_in @user
    with_audio_path(->(*) { @audio }) do
      post mentor_voice_path, params: { mentor_slug: "yoda", text: "Size matters not." }, as: :json
    end
    assert_response :success
    assert_equal "audio/mpeg", response.media_type
    assert_equal "ID3fake-mp3", response.body
  end

  test "only speaks that mentor's own quotes" do
    sign_in @user
    post mentor_voice_path, params: { mentor_slug: "yoda", text: "Say anything I want" }, as: :json
    assert_response :unprocessable_entity
    post mentor_voice_path, params: { mentor_slug: "nobody", text: "Size matters not." }, as: :json
    assert_response :not_found
  end

  test "answers 204 so the browser falls back when edge-tts is unavailable" do
    sign_in @user
    with_audio_path(->(*) { raise MentorVoice::Unavailable, "missing" }) do
      post mentor_voice_path, params: { mentor_slug: "sonic", text: "Gotta go fast!" }, as: :json
    end
    assert_response :no_content
    assert_equal "unavailable", response.headers["X-Mentor-Voice"]
  end

  test "every profile maps to a seeded mentor name" do
    { "David Goggins" => "goggins", "Arnold “The Oak”" => "arnold", "Master Yoda" => "yoda",
      "Sonic" => "sonic", "Mikasa Ackerman" => "mikasa", "Jonah Hill" => "jonah" }.each do |name, slug|
      assert_equal slug, MentorVoice.slug_for(name)
      assert_equal 3, MentorVoice.quotes_for(name).size
    end
  end
end
