class WorkoutPlan < ApplicationRecord
  PROFILE_FIELDS = %i[title fitness_level equipment training_days duration_minutes description].freeze
  GOALS = {
    bulking: 'bulking', strength: 'strength', endurance: 'endurance',
    losing_weight: 'losing_weight', mobility: 'mobility'
  }.freeze
  FITNESS_LEVELS = {
    beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced'
  }.freeze

  belongs_to :user
  belongs_to :mentor, optional: true
  has_many :chats, dependent: :destroy

  enum :goal, GOALS, validate: { allow_nil: true }
  enum :fitness_level, FITNESS_LEVELS, validate: { allow_nil: true }

  validates :title, presence: true
  validates :fitness_level, presence: true, on: %i[create profile_step]
  validates :mentor, :goal, presence: true, unless: -> { validation_context == :profile_step }
  validates :training_days, numericality: { only_integer: true, in: 1..7 }
  validates :duration_minutes, numericality: { only_integer: true, greater_than: 0 }
end
