class PagesController < ApplicationController
  skip_before_action :authenticate_user!, only: [:home]

  def home
    @mentors = Mentor.selectable.order(:id)
  end
end
