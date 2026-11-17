class ChatsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_workout_plan

  def index
    @chats = @workout_plan.chats.order(created_at: :desc)
  end

  def create
    @chat = @workout_plan.chats.new(title: "Untitled")

    if @chat.save
      redirect_to workout_plan_chat_path(@workout_plan, @chat)
    else
      @chats = @workout_plan.chats
      render "workout_plans/show", status: :unprocessable_entity
    end
  end

  def show
    @chat = @workout_plan.chats.find(params[:id])
    @messages = @chat.messages.order(:created_at)
    @message = @chat.messages.build
  end

  private

  def set_workout_plan
    @workout_plan = WorkoutPlan.find(params[:workout_plan_id])
  end
end
