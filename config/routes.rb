Rails.application.routes.draw do
  devise_for :users

  root to: "pages#home"

  resources :workout_plans do
    resources :chats, only: %i[create show]
    resources :workout_logs, only: :create
  end

  resources :chats, only: [] do
    resources :messages, only: :create
  end

  resources :workout_change_proposals, only: [] do
    member do
      patch :accept
      patch :reject
    end
  end

  resources :mentors, only: %i[index show] do
    member do
      patch :assign
    end
  end

  # Neural voice-over for the 3D mentor stage (edge-tts, cached)
  post "mentor_voice", to: "mentor_voices#create", as: :mentor_voice

  get "up" => "rails/health#show", as: :rails_health_check
end