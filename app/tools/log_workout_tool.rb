class LogWorkoutTool
  def initialize(workout_plan:)
    # Pass the WorkoutPlan Active Record object here,
    # not its generated_workout hash.
    @workout_plan = workout_plan
  end

  def call(day_name:, notes: "")
    days = @workout_plan.generated_workout&.fetch("days", []) || []

    day = days.find do |workout_day|
      workout_day["name"].to_s.casecmp?(day_name.to_s.strip)
    end

    return { success: false, error: "That day isn't in this workout plan." } unless day

    cleaned_notes = notes.to_s.strip

    return { success: false, error: "Notes must be 1,000 characters or fewer." } if cleaned_notes.length > 1_000

    log = @workout_plan.workout_logs.create(
      day_name: day["name"],
      completed_at: Time.current,
      notes: cleaned_notes.presence
    )

    if log.persisted?
      {
        success: true,
        day_name: log.day_name,
        completed_at: log.completed_at.iso8601
      }
    else
      {
        success: false,
        error: log.errors.full_messages.to_sentence
      }
    end
  end
end
