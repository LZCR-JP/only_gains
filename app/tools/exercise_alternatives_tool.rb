class ExerciseAlternativesTool
  ALTERNATIVES = [
    [/push[- ]?ups?/i, ["Incline push-up", "Wall push-up"]],
    [/\bsquats?\b/i, ["Chair squat", "Box squat"]],
    [/\blunges?\b/i, ["Reverse lunge", "Supported split squat"]],
    [/\bplanks?\b/i, ["Incline plank", "Dead bug"]],
    [/\bburpees?\b/i, ["Step-back burpee", "Squat to reach"]],
    [/jumping jacks?/i, ["Step jack", "March in place"]],
    [/mountain climbers?/i, ["Standing knee drive", "Bird dog"]]
  ].freeze

  def initialize(workout_plan:)
    @workout_plan = workout_plan
  end

  def call(exercise_name:)
    exercise = @workout_plan.fetch("days", [])
                            .flat_map { |day| day.fetch("exercises", []) }
                            .find do |item|
      item["name"].to_s.casecmp?(exercise_name.to_s.strip)
    end

    return { error: "That exercise is not in this workout." } unless exercise

    alternatives = ALTERNATIVES.find do |pattern, _options|
      exercise["name"].match?(pattern)
    end&.last

    return { error: "I don't have a curated alternative for that exercise yet." } unless alternatives

    {
      original_exercise: exercise["name"],
      alternatives: alternatives
    }
  end
end
