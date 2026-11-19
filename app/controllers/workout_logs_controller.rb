class WorkoutLogsController < ApplicationController
  before_action :authenticate_user!

  def create
    @workout_plan = current_user.workout_plans.find(params[:workout_plan_id])
    day_name = params.require(:workout_log).permit(:day_name)[:day_name].to_s.strip
    days = @workout_plan.generated_workout&.fetch("days", []) || []

    day_index = days.index { |day| day["name"] == day_name }

    unless day_index
      redirect_to workout_plan_path(@workout_plan),
                  alert: "That workout day wasn't found.",
                  status: :see_other
      return
    end

    week = Time.current.all_week
    existing_log = @workout_plan.workout_logs
                                .where(day_name: day_name, completed_at: week)
                                .exists?

    if existing_log
      redirect_to workout_plan_path(
        @workout_plan,
        anchor: "workout-day-#{day_index + 1}"
      ),
                  notice: "This workout is already logged for this week.",
                  status: :see_other
      return
    end

    log = @workout_plan.workout_logs.create(
      day_name: day_name,
      completed_at: Time.current
    )

    if log.persisted?
      redirect_to workout_plan_path(
        @workout_plan,
        anchor: "workout-day-#{day_index + 1}"
      ),
                  notice: "Workout logged. Nice work!",
                  status: :see_other
    else
      redirect_to workout_plan_path(
        @workout_plan,
        anchor: "workout-day-#{day_index + 1}"
      ),
                  alert: log.errors.full_messages.to_sentence,
                  status: :see_other
    end
  end
end
