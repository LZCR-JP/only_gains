require "test_helper"

class GainsFlowTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = User.create!(email: "t@example.com", password: "password", nickname: "Tester")
    @other = User.create!(email: "o@example.com", password: "password")
    @arnold = Mentor.create!(name: "Arnold", emoji: "🏆", avatar_url: "mentors/arnold.jpg", badge: "Pump", tagline: "Lift!", system_prompt: "x")
    @yoda = Mentor.create!(name: "Yoda", emoji: "🟢", badge: "Zen", tagline: "Do.", system_prompt: "y")
    @plan = @user.workout_plans.create!(title: "Mine", goal: :bulking, fitness_level: :beginner,
                                        mentor: @arnold, training_days: 3, duration_minutes: 30)
    @foreign = @other.workout_plans.create!(title: "Theirs", goal: :mobility, mentor: @arnold,
                                            training_days: 2, duration_minutes: 20)
  end

  test "home is public and shows mentor quotes" do
    get root_path
    assert_response :success
    assert_includes response.body, "Lift!"
    assert_select "img.gf-brand-logo[src*='logo']"
    assert_select "[data-controller='music'][data-music-src-value*='background-music']"
    assert_select "button[data-action='music#toggle']"
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

  test "mentor photos show, with emoji fallback" do
    sign_in @user
    get mentors_path
    assert_select "img.gf-avatar[alt='Arnold'][src*='mentors/arnold']"
    assert_select "span.gf-avatar-emoji[aria-label='Yoda']"
  end

  test "assigning a mentor to a plan" do
    sign_in @user
    patch assign_mentor_path(@yoda), params: { workout_plan_id: @plan.id }
    assert_redirected_to workout_plan_path(@plan)
    assert_equal @yoda, @plan.reload.mentor
    follow_redirect!
    assert_select ".gf-toast", /Yoda/
  end

  test "cannot assign a mentor to someone else's plan" do
    sign_in @user
    patch assign_mentor_path(@yoda), params: { workout_plan_id: @foreign.id }
    assert_equal @arnold, @foreign.reload.mentor
  end

  test "invalid enum values are rejected" do
    sign_in @user
    assert_no_difference "WorkoutPlan.count" do
      post workout_plans_path, params: { workout_plan: { title: "X", goal: "nonsense", mentor_id: @arnold.id,
                                                         training_days: 3, duration_minutes: 30 } }
    end
    assert_response :unprocessable_entity
  end
end
