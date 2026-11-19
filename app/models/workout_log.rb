class WorkoutLog < ApplicationRecord
  belongs_to :workout_plan

  validates :day_name, presence: true
  validates :completed_at, presence: true
end
