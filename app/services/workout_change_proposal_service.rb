class WorkoutChangeProposalService
  def initialize(goal:, workout_plan:)
    @mentor = Mentor.for_goal(goal)
    @workout_plan = workout_plan
    @client = OpenAI::Client.new
  end

  def call(message)
    response = @client.responses.create(
      model: "gpt-4o-mini",
      instructions: <<~INSTRUCTIONS,
        You are an AI fitness coach for OnlyGains.

        Your personality:
        #{@mentor.system_prompt}

        Current workout plan:
        #{@workout_plan.to_json}

        The user wants to modify their workout.

        Rules:
        - Suggest exactly ONE exercise replacement.
        - Select an existing exercise from the current plan.
        - Keep the replacement appropriate for the user's goal,
          fitness level, equipment, and available time.
        - Prefer realistic home exercises.
        - Explain why the replacement is appropriate.
        - Never claim that the workout was already updated.
        - Do not modify the database.
        - Speak in your mentor personality.

        Return only valid JSON with this exact structure:

        {
          "message": "Coach's response in character",
          "proposal": {
            "day_name": "Exact day name from the plan",
            "original_exercise": "Exact exercise name from the plan",
            "replacement": {
              "name": "New exercise name",
              "sets": 3,
              "reps": 10,
              "rest_seconds": 60
            },
            "reason": "Why this change is recommended"
          }
        }
      INSTRUCTIONS
      input: "Return your answer as valid JSON.\n\nUser request: #{message}",
      text: { format: { type: "json_object" } }
    )

    result = JSON.parse(response.output_text)
    validate_proposal!(result)

    result
  end

  private

  def validate_proposal!(result)
    proposal = result.fetch("proposal")
    day = @workout_plan.fetch("days").find do |item|
      item["name"] == proposal.fetch("day_name")
    end

    raise "Workout day not found" unless day

    original = day.fetch("exercises").find do |exercise|
      exercise["name"] == proposal.fetch("original_exercise")
    end

    raise "Original exercise not found" unless original

    replacement = proposal.fetch("replacement")

    raise "Invalid replacement name" unless replacement["name"].is_a?(String) && replacement["name"].strip.length > 0

    %w[sets reps rest_seconds].each do |key|
      value = replacement[key]
      raise "Invalid #{key}" unless value.is_a?(Integer) && value >= 0
    end

    raise "Invalid sets or reps" unless replacement["sets"] > 0 && replacement["reps"] > 0
  end
end
