class WorkoutGeneratorService
  class GenerationError < StandardError; end

  def initialize(goal:, fitness_level:, equipment:,
                 training_days:, duration_minutes:)
    @goal = goal
    @fitness_level = fitness_level
    @equipment = equipment.presence || "bodyweight"
    @training_days = training_days.to_i
    @duration_minutes = duration_minutes.to_i
  end

  def call
    client = OpenAI::Client.new

    response = client.responses.create(
      model: "gpt-4o-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    )

    plan = JSON.parse(response.output_text)
    validate_plan!(plan)
    plan
  rescue StandardError => e
    Rails.logger.error("Workout generation failed: #{e.class}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise GenerationError, "Unable to generate workout. Please try again."
  end

  private

  def prompt
    <<~PROMPT
      You are the AI workout generator for OnlyGains.

      Create a safe, realistic home workout plan.

      User information:
      Goal: #{@goal}
      Fitness level: #{@fitness_level}
      Equipment: #{@equipment}
      Training days: #{@training_days}
      Duration: #{@duration_minutes} minutes per session

      Goal-specific requirements:
      - Bulking: hypertrophy and progressive overload.
      - Endurance: cardiovascular and muscular endurance.
      - Losing weight: sustainable activity and
        balanced full-body training.

      General requirements:
      - Create exactly #{@training_days} workout days.
      - Prioritize bodyweight exercises.
      - Only use equipment the user has.
      - Include suitable warm-up and recovery advice.
      - Match the user's fitness level.
      - Keep workouts within the requested duration.
      - Never encourage unsafe training.
      - All sets, reps, and rest_seconds must be integers.
      - Sets must be between 1 and 10.
      - Reps must be between 1 and 100.
      - Rest seconds must be between 0 and 600.
      - Never use strings or ranges for numeric values.
      - For now, only use repetition-based exercises.
      - Do not use time-based exercises.
      - Never omit any required JSON fields.

      Return valid JSON only:

      {
        "title": "Workout plan title",
        "goal": "#{@goal}",
        "days": [
          {
            "name": "Day 1 - Full Body",
            "exercises": [
              {
                "name": "Push-ups",
                "sets": 3,
                "reps": 10,
                "rest_seconds": 60
              }
            ]
          }
        ]
      }

      No markdown.
    PROMPT
  end

  def validate_plan!(plan)
    unless plan.is_a?(Hash) &&
           plan["goal"] == @goal &&
           plan["title"].is_a?(String) &&
           plan["title"].present?
      raise GenerationError
    end

    days = plan["days"]

    unless days.is_a?(Array) &&
           days.length == @training_days
      raise GenerationError
    end

    days.each do |day|
      unless day.is_a?(Hash) &&
             day["name"].is_a?(String) &&
             day["name"].present? &&
             day["exercises"].is_a?(Array) &&
             day["exercises"].any?
        raise GenerationError
      end

      day["exercises"].each do |exercise|
        Rails.logger.debug("Validating exercise: #{exercise.inspect}")
        next if exercise.is_a?(Hash) &&
                exercise["name"].is_a?(String) &&
                exercise["name"].present? &&
                exercise["sets"].is_a?(Integer) &&
                exercise["sets"].between?(1, 10) &&
                exercise["reps"].is_a?(Integer) &&
                exercise["reps"].between?(1, 100) &&
                exercise["rest_seconds"].is_a?(Integer) &&
                exercise["rest_seconds"].between?(0, 600)

        raise GenerationError, "Invalid exercise: #{exercise.inspect}"
      end
    end
  end
end
