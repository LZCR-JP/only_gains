class Message < ApplicationRecord
  belongs_to :chat

  has_one :workout_change_proposal, dependent: :destroy

  delegate :workout_plan, to: :chat

  validates :role, inclusion: { in: ["user", "assistant"] }
  validates :content, presence: true

  def system_prompt
    <<~PROMPT
      #{workout_plan.mentor.system_prompt}

      The user's plan: #{workout_plan.title}.
      Goal: #{workout_plan.goal}. Level: #{workout_plan.fitness_level}.
      Equipment: #{workout_plan.equipment}.
    PROMPT
  end
end
