class Mentor < ApplicationRecord
  has_many :workout_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true

<<<<<<< HEAD
  def display_name
    [emoji, name].compact_blank.join(" ")
=======
  GOAL_MENTORS = {
    "losing_weight" => "Jonah Hill",
    "bulking" => "Arnold",
    "endurance" => "Goggins"
  }.freeze

  def self.for_goal(goal)
    mentor_name = GOAL_MENTORS.fetch(goal.to_s) do
      raise ArgumentError, "Unknown workout goal: #{goal}"
    end

    find_by!(name: mentor_name)
>>>>>>> 5df6577a9b45a9f1e284f9e6063d8427fbe09d02
  end
end
