class Mentor < ApplicationRecord
  has_many :workout_plans

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true

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
  end
end
