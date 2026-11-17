class AddTaglineBadgeEmojiToMentors < ActiveRecord::Migration[8.1]
  def change
    add_column :mentors, :tagline, :string
    add_column :mentors, :badge, :string
    add_column :mentors, :emoji, :string
  end
end
