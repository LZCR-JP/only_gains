class WorkoutPlansController < ApplicationController
  before_action :set_workout_plan, only: %i[show edit update destroy rename]
  before_action :load_mentors, only: %i[new create edit update]

  def index
    @workout_plans = current_user.workout_plans.includes(:mentor).order(created_at: :desc)
  end

  def show
    @days = @workout_plan.generated_workout&.fetch("days", []) || []
    @chats = @workout_plan.chats.order(created_at: :desc, id: :desc).to_a

    week_logs = @workout_plan.workout_logs.where(
      completed_at: Time.current.all_week
    )

    @completed_day_names = week_logs.distinct.pluck(:day_name)
    @completed_sessions = @completed_day_names.size
    @weekly_target = @workout_plan.training_days.to_i

    @progress_percentage =
      if @weekly_target.positive?
        [(@completed_sessions.to_f / @weekly_target * 100).round, 100].min
      else
        0
      end

    @next_day_index =
      @days.index { |day| !@completed_day_names.include?(day["name"]) } || 0
  end

  # Step 1: GET /workout_plans/new displays all six coaches.
  # Step 2: GET /workout_plans/new?mentor_id=ID shows the profile form.
  # Nothing is written to the database until Create is submitted.
  def new
    @workout_plan = current_user.workout_plans.new(
      fitness_level: "beginner", training_days: 3, duration_minutes: 30
    )

    return unless params[:mentor_id].present?

    @selected_mentor = @mentors.find_by(id: params[:mentor_id])
    unless @selected_mentor
      redirect_to new_workout_plan_path, alert: "Please choose an available coach."
      return
    end

    @workout_plan.mentor = @selected_mentor
    @workout_plan.goal = @selected_mentor.training_goal
    render :profile
  end

  def create
    @workout_plan = current_user.workout_plans.build(profile_params)
    @selected_mentor = @mentors.find_by(id: params.dig(:workout_plan, :mentor_id))

    unless @selected_mentor
      @workout_plan.errors.add(:mentor, "Please choose an available coach.")
      render :new, status: :unprocessable_entity
      return
    end

    # The coach determines the goal; ignore any goal submitted by the browser.
    @workout_plan.mentor = @selected_mentor
    @workout_plan.goal = @selected_mentor.training_goal
    base_title = "#{@selected_mentor.display_name}’s Plan"

    version = current_user.workout_plans.where(mentor: @selected_mentor).count + 1

    title = version == 1 ? base_title : "#{base_title} V#{version}"

    while current_user.workout_plans.exists?(title: title)
      version += 1
      title = "#{base_title} V#{version}"
    end

    @workout_plan.title = title

    if @workout_plan.valid? && generate_workout && @workout_plan.save
      redirect_to @workout_plan, notice: "AI workout plan created!", status: :see_other
    else
      render :profile, status: :unprocessable_entity
    end
  end

  def edit
    # A coach picked from the mentor page is only previewed until Save.
    return unless params[:mentor_id].present?

    mentor = @mentors.find_by(id: params[:mentor_id])
    @workout_plan.mentor = mentor if mentor
  end

  def update
    @workout_plan.assign_attributes(profile_params)
    assign_selected_mentor

    regenerate = @workout_plan.generated_workout.blank? ||
                 %w[mentor_id goal fitness_level equipment training_days duration_minutes description]
                 .any? { |attribute| @workout_plan.will_save_change_to_attribute?(attribute) }

    if @workout_plan.valid? && (!regenerate || generate_workout) && @workout_plan.save
      redirect_to @workout_plan, notice: "Workout plan updated!", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @workout_plan.destroy!
    redirect_to workout_plans_path, notice: "Workout plan deleted!", status: :see_other
  end

  def rename
    title = params.require(:workout_plan).permit(:title)[:title].to_s.strip

    if title.length.between?(1, 100) && @workout_plan.update(title: title)
      redirect_to workout_plans_path,
                  notice: "Plan renamed successfully!",
                  status: :see_other
    else
      redirect_to workout_plans_path,
                  alert: "Please enter a valid plan name (1–100 characters).",
                  status: :see_other
    end
  end

  private

  def load_mentors
    @mentors = Mentor.selectable.order(:id)
  end

  def assign_selected_mentor
    @workout_plan.mentor = @mentors.find_by(id: params.require(:workout_plan)[:mentor_id])
    @workout_plan.goal = @workout_plan.mentor&.training_goal
  end

  def generate_workout
    @workout_plan.generated_workout = WorkoutGeneratorService.new(
      goal: @workout_plan.goal,
      mentor: @workout_plan.mentor,
      fitness_level: @workout_plan.fitness_level,
      equipment: @workout_plan.equipment,
      training_days: @workout_plan.training_days,
      duration_minutes: @workout_plan.duration_minutes,
      description: @workout_plan.description
    ).call
    true
  rescue WorkoutGeneratorService::GenerationError => e
    @workout_plan.errors.add(:base, e.message)
    false
  end

  def set_workout_plan
    @workout_plan = current_user.workout_plans.find(params[:id])
  end

  def profile_params
    params.require(:workout_plan).permit(
      :fitness_level,
      :training_days,
      :duration_minutes,
      :description,
      :mentor_id,
      equipment_list: []
    )
  end
end
