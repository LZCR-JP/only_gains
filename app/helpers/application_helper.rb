module ApplicationHelper
  def mentor_photo_path(mentor, variant: :default)
    original = mentor.avatar_url

    return original if original.blank?
    return original unless original.start_with?("mentors/")
    return original unless %w[home quotes selection].include?(variant.to_s)

    filename = File.basename(original)
    candidate = "mentors/#{variant}/#{filename}"

    if File.file?(Rails.root.join("app/assets/images", candidate))
      candidate
    else
      original
    end
  end

  def mentor_avatar(mentor, size: :md, variant: :default)
    classes = [
      "gf-avatar",
      ("gf-avatar-#{size}" unless size == :md)
    ].compact

    photo = mentor_photo_path(mentor, variant: variant)

    if photo.present?
      image_tag photo,
                alt: mentor.name,
                class: classes,
                loading: "lazy"
    else
      content_tag :span,
                  mentor.emoji,
                  class: classes + ["gf-avatar-emoji"],
                  role: "img",
                  aria: { label: mentor.name }
    end
  end
end
