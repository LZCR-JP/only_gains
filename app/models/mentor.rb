class Mentor < ApplicationRecord
  has_many :workout_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true

  def display_name
    [emoji, name].compact_blank.join(" ")
  end
end
