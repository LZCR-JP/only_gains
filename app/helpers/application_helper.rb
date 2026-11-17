module ApplicationHelper
  # Mentor profile picture (falls back to the emoji tile if no picture is set).
  # size: :md (default), :lg, :xl
  def mentor_avatar(mentor, size: :md)
    classes = ["gf-avatar", ("gf-avatar-#{size}" unless size == :md)]

    if mentor.avatar_url.present?
      image_tag mentor.avatar_url, alt: mentor.name, class: classes, loading: "lazy"
    else
      content_tag :span, mentor.emoji, class: classes + ["gf-avatar-emoji"], role: "img", aria: { label: mentor.name }
    end
  end
end
