class Mentor < ApplicationRecord
  has_many :workout_plans

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true
end
