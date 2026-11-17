class AiCoachService
  def initialize(goal:, workout_plan:)
    @mentor = Mentor.for_goal(goal)
    @workout_plan = workout_plan
    @client = OpenAI::Client.new
  end

  def chat(message)
    response = @client.responses.create(
      model: "gpt-4o-mini",
      instructions: <<~INSTRUCTIONS,
        #{@mentor.system_prompt}

        You are an AI fitness coach for OnlyGains.

        Current workout plan:
        #{@workout_plan.to_json}

        Rules:
        - Always maintain your unique personality.
        - Give realistic and practical fitness advice.
        - Keep responses conversational and entertaining.
        - Adapt advice to the user's fitness goal.
        - Never encourage unsafe training.
        - Never modify the workout without user approval.
        - Never claim that unapproved changes have been saved.
        - Reply in the user's language.
      INSTRUCTIONS
      input: message
    )

    response.output_text
  end
end
