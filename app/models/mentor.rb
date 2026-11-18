class Mentor < ApplicationRecord
  has_many :workout_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true

  # Names match db/seeds.rb. The selected coach determines the training goal.
  COACHES = {
    'Arnold “The Oak”' => { goal: 'bulking', specialty: 'Muscle building & hypertrophy' },
    'Master Yoda' => { goal: 'mobility', specialty: 'Mobility & flexibility' },
    'David Goggins' => { goal: 'endurance', specialty: 'Stamina & endurance' },
    'Jonah Hill' => { goal: 'losing_weight', specialty: 'Sustainable fat loss & boxing cardio' },
    'Sonic' => { goal: 'endurance', specialty: 'Speed, HIIT & conditioning' },
    'Mikasa Ackerman' => { goal: 'strength', specialty: 'Functional strength & core stability' }
  }.freeze

  # Compatibility for older console calls to the AI services.
  GOAL_MENTORS = {
    'bulking' => 'Arnold “The Oak”',
    'mobility' => 'Master Yoda',
    'endurance' => 'David Goggins',
    'losing_weight' => 'Jonah Hill',
    'strength' => 'Mikasa Ackerman'
  }.freeze

  scope :selectable, -> { where(name: COACHES.keys) }

  def self.for_goal(goal)
    find_by!(name: GOAL_MENTORS.fetch(goal.to_s))
  end

  def display_name
    name
  end

  def training_goal
    COACHES.dig(name, :goal)
  end

  def specialty
    COACHES.dig(name, :specialty) || 'General fitness'
  end
end
