class WorkoutLogsTool
  LIMIT = 10

  def initialize(workout_plan:)
    @workout_plan = workout_plan
  end

  def call
    logs = @workout_plan.workout_logs
                        .order(completed_at: :desc)
                        .limit(LIMIT)

    {
      success: true,
      logs: logs.map do |log|
        {
          day_name: log.day_name,
          completed_at: log.completed_at.in_time_zone.strftime("%Y-%m-%d %H:%M %Z"),
          notes: log.notes
        }
      end
    }
  end
end
