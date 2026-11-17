class WorkoutPlansController < ApplicationController
  before_action :authenticate_user!
  before_action :set_workout_plan, only: %i[show edit update destroy]

  def index
    @workout_plans = current_user.workout_plans
  end

  def show
  end

  def new
    @workout_plan = current_user.workout_plans.new
  end

  def create
    @workout_plan = current_user.workout_plans.build(workout_plan_params)

    if prepare_workout && generate_workout && @workout_plan.save
      redirect_to @workout_plan, notice: "AI workout plan created!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    @workout_plan.assign_attributes(workout_plan_params)

    regenerate = @workout_plan.generated_workout.blank? ||
                 %w[goal fitness_level equipment training_days duration_minutes]
                 .any? { |attribute| @workout_plan.will_save_change_to_attribute?(attribute) }

    if prepare_workout &&
       (!regenerate || generate_workout) &&
       @workout_plan.save

      redirect_to @workout_plan, notice: "Workout plan updated!"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @workout_plan.destroy!

    redirect_to workout_plans_path,
                notice: "Workout plan deleted!",
                status: :see_other
  end

  private

  def prepare_workout
    @workout_plan.mentor = Mentor.for_goal(@workout_plan.goal) if Mentor::GOAL_MENTORS.key?(@workout_plan.goal)

    @workout_plan.valid?(:onboarding)
  rescue ActiveRecord::RecordNotFound
    @workout_plan.errors.add(:base, "AI mentor is unavailable.")
    false
  end

  def generate_workout
    generated = WorkoutGeneratorService.new(
      goal: @workout_plan.goal,
      fitness_level: @workout_plan.fitness_level,
      equipment: @workout_plan.equipment,
      training_days: @workout_plan.training_days,
      duration_minutes: @workout_plan.duration_minutes
    ).call

    @workout_plan.generated_workout = generated
    true
  rescue WorkoutGeneratorService::GenerationError => e
    @workout_plan.errors.add(:base, e.message)
    false
  end

  def set_workout_plan
    @workout_plan = current_user.workout_plans.find(params[:id])
  end

  def workout_plan_params
    params.require(:workout_plan).permit(
      :title,
      :goal,
      :fitness_level,
      :equipment,
      :training_days,
      :duration_minutes,
      :description
    )
  end
end
