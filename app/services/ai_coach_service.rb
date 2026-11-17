class AiCoachService
  class ChatError < StandardError; end

  def initialize(goal:, workout_plan:, mentor: nil)
    @mentor = mentor || Mentor.for_goal(goal)
    @workout_plan = workout_plan
  end

  def chat(message, history: [])
    client = OpenAI::Client.new

    messages = history + [
      { role: "user", content: message }
    ]

    response = client.responses.create(
      model: "gpt-4o-mini",
      instructions: instructions,
      input: messages
    )

    reply = response.output_text

    raise ChatError if reply.blank?

    reply
  rescue StandardError => e
    Rails.logger.error("AI chat failed: #{e.class}")
    raise ChatError, "Your AI coach is unavailable. Please try again."
  end

  private

  def instructions
    <<~PROMPT
      #{@mentor.system_prompt}

      You are an AI fitness coach for OnlyGains.

      Current workout plan and user profile:
      #{@workout_plan.to_json}

      Rules:
      - Always maintain your unique personality.
      - Remember the conversation history provided.
      - Refer to the user's actual workout plan.
      - Give practical fitness recommendations.
      - Prioritize realistic home workouts.
      - Keep replies short and conversational.
      - Avoid excessive emojis.
      - Never encourage unsafe training.
      - Never modify a workout without user approval.
      - Never claim that proposed changes have been saved.
      - Reply in the user's language.
    PROMPT
  end
end
