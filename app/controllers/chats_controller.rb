class ChatsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_workout_plan

  def create
    @chat = @workout_plan.chats.new(
      title: "Chat with #{@workout_plan.mentor.name}"
    )

    if @chat.save
      redirect_to workout_plan_chat_path(@workout_plan, @chat),
                  status: :see_other
    else
      redirect_to @workout_plan,
                  alert: "Unable to create chat.",
                  status: :see_other
    end
  end

  def show
    @chat = @workout_plan.chats.find(params[:id])
    @messages = @chat.messages.order(:created_at, :id)
    @message = @chat.messages.build
  end

  private

  def set_workout_plan
    @workout_plan = current_user.workout_plans.find(
      params[:workout_plan_id]
    )
  end
end
