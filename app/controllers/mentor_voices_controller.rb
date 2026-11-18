# POST /mentor_voice  { mentor_slug: "yoda", text: "Size matters not." }
#
# 200 audio/mpeg  – the neural voice-over (cached in tmp/cache/mentor_voices/)
# 204 No Content  – edge-tts unavailable; the browser falls back to speechSynthesis
#                   (204 rather than 503 so the browser console stays clean)
# 404 / 422       – unknown mentor, or text that isn't one of that mentor's quotes
class MentorVoicesController < ApplicationController
  def create
    slug = params[:mentor_slug].to_s
    text = params[:text].to_s

    return head(:not_found) unless MentorVoice::PROFILES.key?(slug)
    return head(:unprocessable_entity) unless MentorVoice::PROFILES[slug][:quotes].include?(text)

    path = MentorVoice.audio_path(slug, text)
    response.headers["Cache-Control"] = "private, max-age=86400"
    send_file path, type: "audio/mpeg", disposition: "inline"
  rescue MentorVoice::Unavailable => e
    Rails.logger.info("[MentorVoice] #{e.message}")
    response.headers["X-Mentor-Voice"] = "unavailable"
    head :no_content
  end
end
