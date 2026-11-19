class Mentor < ApplicationRecord
  has_many :workout_plans, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true
  validates :system_prompt, presence: true

  # Names match db/seeds.rb. The selected coach determines the training goal.
  COACHES = {
    'Arnold “The Oak”' => { goal: 'bulking', specialty: 'Best for building muscle, strength, and a powerful physique' },
    'Master Yoda' => { goal: 'mobility', specialty: 'Best for flexibility, recovery, and moving without pain' },
    'David Goggins' => { goal: 'endurance', specialty: 'Best for mental toughness, endurance, and breaking limits' },
    'Jonah Hill' => { goal: 'losing_weight',
                      specialty: 'Best for weight loss, healthy habits, and building confidence' },
    'Sonic' => { goal: 'endurance', specialty: 'Best for cardio lovers who want to move faster and train harder' },
    'Mikasa Ackerman' => { goal: 'strength', specialty: 'Best for athletic strength, balance, and total-body control' }
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
