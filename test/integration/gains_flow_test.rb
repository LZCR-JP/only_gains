require "test_helper"

class GainsFlowTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = User.create!(email: "t@example.com", password: "password", nickname: "Tester")
    @other = User.create!(email: "o@example.com", password: "password")
    @arnold = Mentor.create!(name: "Arnold “The Oak”", emoji: "🏆", avatar_url: "mentors/arnold.jpg",
                             badge: "Pump", tagline: "Lift!", system_prompt: "x")
    @yoda = Mentor.create!(name: "Master Yoda", emoji: "🟢", badge: "Zen",
                           tagline: "Do.", system_prompt: "y")
    @plan = @user.workout_plans.create!(title: "Mine", goal: :bulking, fitness_level: :beginner,
                                        mentor: @arnold, training_days: 3, duration_minutes: 30)
    @foreign = @other.workout_plans.create!(title: "Theirs", goal: :mobility, fitness_level: :beginner,
                                             mentor: @arnold, training_days: 2, duration_minutes: 20)
  end

  test "home is public, shows mentor quotes and takes users into coach selection" do
    get root_path
    assert_response :success
    assert_includes response.body, "Lift!"
    assert_select "img.gf-brand-logo[src*='logo']"
    assert_select "[data-controller='music'][data-music-src-value*='background-music']"
    assert_select "button[data-action='music#toggle']"
    assert_select "a", text: "Meet the mentors", count: 0
  end

  test "every signed-in page renders" do
    sign_in @user
    [root_path, workout_plans_path, new_workout_plan_path, workout_plan_path(@plan),
     edit_workout_plan_path(@plan), mentors_path, mentor_path(@yoda),
     new_workout_plan_path(mentor_id: @yoda.id)].each do |path|
      get path
      assert_response :success, path
    end
  end

  test "coach selection is step one and only shows specialty and quote" do
    sign_in @user
    get new_workout_plan_path

    assert_response :success
    assert_select "h1", text: "Choose your coach"
    assert_select "a[href='#{new_workout_plan_path(mentor_id: @yoda.id)}']"
    assert_select "input[name='workout_plan[title]']", count: 0
    assert_select ".gf-mentor-card", minimum: 2
    assert_select ".gf-personality", count: 0
    assert_select ".gf-mentor-card", text: /Do\./
    assert_select "img.gf-avatar[alt='Arnold “The Oak”'][src*='mentors/arnold']"
    assert_select "span.gf-avatar-emoji[aria-label='Master Yoda']"
  end

  test "selecting a coach opens the profile form without saving a plan" do
    sign_in @user
    assert_no_difference "WorkoutPlan.count" do
      get new_workout_plan_path(mentor_id: @yoda.id)
    end
    assert_response :success
    assert_select "h1", text: "Set up your workout"
    assert_select "input[type='hidden'][name='workout_plan[mentor_id]'][value='#{@yoda.id}']"
    assert_select "select[name='workout_plan[fitness_level]']"
    assert_select "input[name='workout_plan[title]']"
    assert_select "a[href='#{new_workout_plan_path}']", text: /Change coach/
    assert_select ".gf-personality", count: 0
  end

  test "unknown coach id returns to coach selection" do
    sign_in @user
    get new_workout_plan_path(mentor_id: -100)
    assert_redirected_to new_workout_plan_path
  end

  test "cannot create a plan with an invalid coach" do
    sign_in @user
    assert_no_difference "WorkoutPlan.count" do
      post workout_plans_path, params: { workout_plan: profile.merge(mentor_id: -1) }
    end
    assert_response :unprocessable_entity
    assert_select "h1", text: "Choose your coach"
  end

  test "invalid profile rerenders the form with the selected coach" do
    sign_in @user
    assert_no_difference "WorkoutPlan.count" do
      post workout_plans_path,
           params: { workout_plan: profile.merge(mentor_id: @yoda.id, fitness_level: "nonsense") }
    end
    assert_response :unprocessable_entity
    assert_select "h1", text: "Set up your workout"
    assert_select "input[type='hidden'][name='workout_plan[mentor_id]'][value='#{@yoda.id}']"
  end

  test "selected coach determines goal and generator input, ignoring submitted goal" do
    sign_in @user
    with_fake_generator do |calls|
      assert_difference "WorkoutPlan.count", 1 do
        post workout_plans_path,
             params: { workout_plan: profile.merge(mentor_id: @yoda.id, goal: "bulking") }
      end
      plan = @user.workout_plans.find_by!(title: "New plan")
      assert_redirected_to workout_plan_path(plan)
      assert_equal @yoda, plan.mentor
      assert_equal "mobility", plan.goal
      assert_equal "mobility", plan.generated_workout["goal"]
      assert_equal @yoda, calls.fetch(0).fetch(:mentor)
      assert_equal "No jumping", calls.fetch(0).fetch(:description)
    end
  end

  test "assigning a coach to an existing plan opens edit without saving" do
    sign_in @user
    patch assign_mentor_path(@yoda), params: { workout_plan_id: @plan.id }
    assert_redirected_to edit_workout_plan_path(@plan, mentor_id: @yoda.id)
    assert_equal @arnold, @plan.reload.mentor
    follow_redirect!
    assert_select "select[name='workout_plan[mentor_id]'] option[selected][value='#{@yoda.id}']"
  end

  test "cannot assign a coach to someone else's plan" do
    sign_in @user
    patch assign_mentor_path(@yoda), params: { workout_plan_id: @foreign.id }
    assert_equal @arnold, @foreign.reload.mentor
  end

  test "changing coaches regenerates the workout after saving" do
    sign_in @user
    with_fake_generator do |calls|
      patch workout_plan_path(@plan),
            params: { workout_plan: profile.merge(title: @plan.title, mentor_id: @yoda.id) }
      assert_redirected_to workout_plan_path(@plan)
      assert_equal @yoda, @plan.reload.mentor
      assert_equal "mobility", @plan.goal
      assert_equal "mobility", @plan.generated_workout["goal"]
      assert_equal 1, calls.length
    end
  end

  private

  def profile
    { title: "New plan", fitness_level: "beginner", equipment: "None",
      training_days: 3, duration_minutes: 30, description: "No jumping" }
  end

  # Prevent OpenAI calls and API charges during these integration tests.
  def with_fake_generator
    calls = []
    fake = Struct.new(:result) { def call = result }
    klass = WorkoutGeneratorService
    klass.define_singleton_method(:new) do |**args|
      calls << args
      days = Array.new(args.fetch(:training_days)) do |index|
        { "name" => "Day #{index + 1}", "exercises" => [
          { "name" => "Squats", "sets" => 3, "reps" => 10, "rest_seconds" => 60 }
        ] }
      end
      fake.new({ "title" => "Generated plan", "goal" => args.fetch(:goal), "days" => days })
    end
    yield calls
  ensure
    klass.singleton_class.remove_method(:new) if klass
  end
end
