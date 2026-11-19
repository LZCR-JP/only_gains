class WorkoutPlan < ApplicationRecord
  PROFILE_FIELDS = %i[title fitness_level equipment training_days duration_minutes description].freeze
  GOALS = {
    bulking: 'bulking', strength: 'strength', endurance: 'endurance',
    losing_weight: 'losing_weight', mobility: 'mobility'
  }.freeze
  FITNESS_LEVELS = {
    beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced'
  }.freeze

  EQUIPMENT_OPTIONS = [
    "Dumbbells",
    "Resistance bands",
    "Kettlebell",
    "Barbell",
    "Bench",
    "Pull-up bar",
    "Yoga mat",
    "Jump rope",
    "Foam roller",
    "Stationary bike",
    "Treadmill"
  ].freeze

  def equipment_list
    equipment.to_s.split(",").map(&:strip).reject(&:blank?)
  end

  def equipment_list=(items)
    self.equipment = Array(items).reject(&:blank?).join(", ").presence
  end

  belongs_to :user
  belongs_to :mentor, optional: true
  has_many :chats, dependent: :destroy
  has_many :workout_logs, dependent: :destroy

  enum :goal, GOALS, validate: { allow_nil: true }, prefix: true
  enum :fitness_level, FITNESS_LEVELS, validate: { allow_nil: true }

  validates :title, presence: true
  validates :fitness_level, presence: true, on: %i[create profile_step]
  validates :mentor, :goal, presence: true, unless: -> { validation_context == :profile_step }
  validates :training_days, numericality: { only_integer: true, in: 1..7 }
  validates :duration_minutes, numericality: { only_integer: true, greater_than: 0 }

  before_validation :sync_training_days_from_schedule
  validate :training_schedule_must_be_valid

  private

  def sync_training_days_from_schedule
    self.training_schedule = Array(training_schedule).reject(&:blank?).uniq
    self.training_days = training_schedule.length
  end

  def training_schedule_must_be_valid
    weekdays = Date::DAYNAMES

    if training_schedule.blank?
      errors.add(:training_schedule, "Choose at least one training day")
    elsif (training_schedule - weekdays).any?
      errors.add(:training_schedule, "contains an invalid weekday")
    end
  end
end
