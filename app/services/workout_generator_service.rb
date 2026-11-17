class WorkoutGeneratorService
  def initialize(goal:, fitness_level:, equipment:, training_days:, duration_minutes:)
    @goal = goal
    @fitness_level = fitness_level
    @equipment = equipment
    @training_days = training_days.to_i
    @duration_minutes = duration_minutes.to_i
    @client = OpenAI::Client.new
  end

  def call
    response = @client.responses.create(
      model: "gpt-4o-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    )

    JSON.parse(response.output_text)
  end

  private

  def prompt
    <<~PROMPT
      You are the AI workout generator for OnlyGains.

      Create a safe and realistic home workout plan.

      User information:
      Goal: #{@goal}
      Fitness level: #{@fitness_level}
      Equipment: #{@equipment}
      Training days: #{@training_days} per week
      Duration: #{@duration_minutes} minutes per session

      Requirements:
      - Create exactly #{@training_days} workout days.
      - Only use the available equipment.
      - Match the user's fitness level and goal.
      - Keep each workout within the requested duration.
      - Include appropriate rest and recovery.

      Return a valid JSON object with:
      {
        "title": "Workout plan title",
        "goal": "#{@goal}",
        "days": [
          {
            "name": "Day 1 - Upper Body",
            "exercises": [
              {
                "name": "Exercise name",
                "sets": 3,
                "reps": 12,
                "rest_seconds": 60
              }
            ]
          }
        ]
      }

      Return JSON only. No markdown.
    PROMPT
  end
end
