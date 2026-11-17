class WorkoutPlan < ApplicationRecord
  GOALS = {
    bulking: "bulking",
    strength: "strength",
    endurance: "endurance",
    losing_weight: "losing_weight",
    mobility: "mobility"
  }.freeze

  FITNESS_LEVELS = {
    beginner: "beginner",
    intermediate: "intermediate",
    advanced: "advanced"
  }.freeze

  belongs_to :user
  belongs_to :mentor
  has_many :chats, dependent: :destroy

  enum :goal, GOALS, validate: true
  enum :fitness_level, FITNESS_LEVELS, validate: { allow_nil: true }

  validates :title, presence: true
<<<<<<< HEAD
  validates :training_days, numericality: { only_integer: true, in: 1..7 }
  validates :duration_minutes, numericality: { only_integer: true, greater_than: 0 }

  def self.goal_options
    goals.keys.map { |key| [key.humanize, key] }
  end

  def self.fitness_level_options
    fitness_levels.keys.map { |key| [key.humanize, key] }
  end
=======
  validates :goal, presence: true
  validates :training_days, numericality: {
    only_integer: true, in: 1..7
  }
  validates :duration_minutes, numericality: {
    only_integer: true, greater_than: 0
  }

  validates :goal,
            inclusion: { in: Mentor::GOAL_MENTORS.keys },
            on: :onboarding

  validates :fitness_level,
            inclusion: { in: %w[beginner intermediate advanced] },
            on: :onboarding
>>>>>>> 5df6577a9b45a9f1e284f9e6063d8427fbe09d02
end
